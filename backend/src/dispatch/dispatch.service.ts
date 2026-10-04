import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AssignDriverDto,
  DispatchBoardQueryDto,
  MarkDeliveredDto,
} from './dto/dispatch.dto.js';

@Injectable()
export class DispatchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to format UTC Date to YYYY-MM-DD
   */
  private formatDateOnly(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Parse YYYY-MM-DD string into a UTC midnight Date
   */
  private parseDateOnly(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10))) {
      throw new BadRequestException('Date must use YYYY-MM-DD format');
    }
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    const result = new Date(Date.UTC(year, month - 1, day));
    if (
      result.getUTCFullYear() !== year ||
      result.getUTCMonth() !== month - 1 ||
      result.getUTCDate() !== day
    ) {
      throw new BadRequestException('Invalid calendar date');
    }
    return result;
  }

  /**
   * Get current date (UTC midnight) in configured timezone
   */
  private async getTodayInKitchenTimezone(): Promise<Date> {
    const setting = await this.prisma.kitchenSetting.findUnique({ where: { id: 1 } });
    const timeZone = setting?.timezone || 'UTC';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date())
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)]),
    ) as { year: number; month: number; day: number };

    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  }

  /**
   * Compute scheduled UTC delivery timestamp from deliveryDate, deliveryTime, and kitchen timezone
   */
  private getScheduledDeliveryUtc(deliveryDate: Date, deliveryTime: string, timeZone: string): Date {
    const [hourStr, minuteStr] = deliveryTime.split(':');
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return deliveryDate;
    }

    const year = deliveryDate.getUTCFullYear();
    const month = deliveryDate.getUTCMonth() + 1;
    const day = deliveryDate.getUTCDate();

    const desiredUtc = Date.UTC(year, month - 1, day, hour, minute);
    let guess = desiredUtc;
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const parts = Object.fromEntries(
        formatter
          .formatToParts(new Date(guess))
          .filter((part) => part.type !== 'literal')
          .map((part) => [part.type, Number(part.value)]),
      ) as Record<string, number>;
      const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
      const adjustment = desiredUtc - represented;
      guess += adjustment;
      if (adjustment === 0) break;
    }
    return new Date(guess);
  }

  /**
   * Ensure a confirmed order is grouped into its proper Drop.
   * Groups by (companyId, addressId, deliveryDate, deliveryTime).
   * Falls back to company default driver if drop is created or has no driver.
   */
  async ensureOrderDrop(orderId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    const order = await client.order.findUnique({
      where: { id: orderId },
      include: {
        company: { select: { id: true, defaultDriverId: true } },
      },
    });

    if (!order || !order.deliveryAddressId) {
      return null;
    }

    // Try to find existing drop with matching unique criteria
    let drop = await client.drop.findUnique({
      where: {
        companyId_addressId_deliveryDate_deliveryTime: {
          companyId: order.companyId,
          addressId: order.deliveryAddressId,
          deliveryDate: order.deliveryDate,
          deliveryTime: order.deliveryTime,
        },
      },
    });

    if (!drop) {
      // Driver assignment fallback: Company default driver -> null
      const driverId = order.company.defaultDriverId ?? null;
      drop = await client.drop.create({
        data: {
          companyId: order.companyId,
          addressId: order.deliveryAddressId,
          deliveryDate: order.deliveryDate,
          deliveryTime: order.deliveryTime,
          driverId,
          status: 'KITCHEN_READY',
        },
      });
    } else if (!drop.driverId && order.company.defaultDriverId) {
      // If drop had no driver, populate with company default driver
      drop = await client.drop.update({
        where: { id: drop.id },
        data: { driverId: order.company.defaultDriverId },
      });
    }

    if (order.dropId !== drop.id) {
      await client.order.update({
        where: { id: order.id },
        data: { dropId: drop.id },
      });
    }

    return drop;
  }

  /**
   * Sync all confirmed orders without a dropId into Drops
   */
  async syncConfirmedOrdersToDrops() {
    const pendingOrders = await this.prisma.order.findMany({
      where: {
        status: 'CONFIRMED',
        deliveryAddressId: { not: null },
        dropId: null,
      },
      select: { id: true },
    });

    for (const order of pendingOrders) {
      await this.ensureOrderDrop(order.id);
    }
  }

  /**
   * Dispatch Board: List all drops grouped/filtered by operational state
   */
  async listDispatchBoard(query: DispatchBoardQueryDto) {
    // Sync any unlinked confirmed orders into drops first
    await this.syncConfirmedOrdersToDrops();

    const where: Prisma.DropWhereInput = {};

    if (query.deliveryDate) {
      where.deliveryDate = this.parseDateOnly(query.deliveryDate);
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.companyId) {
      where.companyId = query.companyId;
    }

    if (query.driverId) {
      where.driverId = query.driverId;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [total, drops] = await Promise.all([
      this.prisma.drop.count({ where }),
      this.prisma.drop.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              driverInstructions: true,
              defaultPackaging: true,
            },
          },
          address: {
            select: {
              id: true,
              label: true,
              line1: true,
              line2: true,
              city: true,
              state: true,
              postalCode: true,
            },
          },
          driver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          orders: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              packaging: true,
              kitchenReadyAt: true,
              plannedKitchenReadyAt: true,
              plannedDispatchReadyAt: true,
              employee: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              lines: {
                select: {
                  id: true,
                  dishNameSnapshot: true,
                  quantity: true,
                },
              },
              prepUnits: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: [
          { deliveryDate: 'asc' },
          { deliveryTime: 'asc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
    ]);

    const formattedDrops = drops.map((drop) => {
      const orders = drop.orders;
      const isKitchenComplete =
        orders.length > 0 &&
        orders.every(
          (o) =>
            o.kitchenReadyAt !== null &&
            o.prepUnits.every((u) => u.status === 'DONE'),
        );

      const hasKitchenUnits = orders.some((o) => o.prepUnits.length > 0);

      return {
        id: drop.id,
        company: drop.company,
        address: drop.address,
        deliveryDate: this.formatDateOnly(drop.deliveryDate),
        deliveryTime: drop.deliveryTime,
        status: drop.status,
        driver: drop.driver,
        outForDeliveryAt: drop.outForDeliveryAt,
        deliveredAt: drop.deliveredAt,
        deliveredOnTime: drop.deliveredOnTime,
        deliveryNote: drop.deliveryNote,
        deliveryPhotoUrl: drop.deliveryPhotoUrl,
        kitchenReadiness: {
          isComplete: isKitchenComplete,
          hasKitchenUnits,
          totalOrders: orders.length,
          readyOrders: orders.filter((o) => o.kitchenReadyAt !== null).length,
        },
        orders: orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          packaging: o.packaging,
          employee: o.employee,
          itemCount: o.lines.reduce((acc, line) => acc + line.quantity, 0),
          isKitchenReady: o.kitchenReadyAt !== null,
        })),
      };
    });

    return {
      drops: formattedDrops,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get drop details including associated orders and timeline events
   */
  async getDropDetail(dropId: string) {
    const drop = await this.prisma.drop.findUnique({
      where: { id: dropId },
      include: {
        company: true,
        address: true,
        driver: { select: { id: true, name: true, email: true } },
        orders: {
          include: {
            employee: true,
            lines: {
              include: {
                combinations: {
                  include: {
                    options: true,
                    portionSize: true,
                  },
                },
              },
            },
            prepUnits: {
              include: {
                station: true,
              },
            },
            events: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!drop) {
      throw new NotFoundException('Delivery drop not found');
    }

    return {
      ...drop,
      deliveryDate: this.formatDateOnly(drop.deliveryDate),
    };
  }

  /**
   * List available drivers
   */
  async listDrivers() {
    return this.prisma.user.findMany({
      where: {
        active: true,
        role: {
          permissions: {
            some: { permission: { key: 'deliveries.readOwn' } },
          },
        },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Assign or reassign a driver to a drop
   */
  async assignDriver(dropId: string, dto: AssignDriverDto, actorId: string) {
    const drop = await this.prisma.drop.findUnique({
      where: { id: dropId },
      include: { orders: { select: { id: true } } },
    });

    if (!drop) {
      throw new NotFoundException('Delivery drop not found');
    }

    let driver = null;
    if (dto.driverId) {
      driver = await this.prisma.user.findFirst({
        where: {
          id: dto.driverId,
          active: true,
          role: {
            permissions: {
              some: { permission: { key: 'deliveries.readOwn' } },
            },
          },
        },
      });

      if (!driver) {
        throw new BadRequestException('Selected driver is not active or authorized');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedDrop = await tx.drop.update({
        where: { id: dropId },
        data: { driverId: dto.driverId ?? null },
        include: {
          driver: { select: { id: true, name: true, email: true } },
        },
      });

      // Record OrderEvent for each order in the drop
      for (const order of drop.orders) {
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            actorId,
            type: 'DRIVER_ASSIGNED',
            details: {
              driverId: dto.driverId ?? null,
              driverName: driver ? driver.name : 'Unassigned',
            },
          },
        });
      }

      return updatedDrop;
    });
  }

  /**
   * Transition: Kitchen Ready -> Dispatch Ready
   * Validates that all orders in drop have completed kitchen preparation.
   */
  async markDispatchReady(dropId: string, actorId: string) {
    const drop = await this.prisma.drop.findUnique({
      where: { id: dropId },
      include: {
        orders: {
          include: {
            prepUnits: true,
          },
        },
      },
    });

    if (!drop) {
      throw new NotFoundException('Delivery drop not found');
    }

    // Idempotent: if already dispatch ready or further, return safely
    if (drop.status === 'DISPATCH_READY' || drop.status === 'OUT_FOR_DELIVERY' || drop.status === 'DELIVERED') {
      return drop;
    }

    if (drop.orders.length === 0) {
      throw new BadRequestException('Cannot mark Dispatch Ready: Drop has no orders');
    }

    // Check kitchen completion for all orders in drop
    for (const order of drop.orders) {
      if (order.status !== 'CONFIRMED') {
        throw new ConflictException(`Order ${order.orderNumber} is not confirmed`);
      }
      if (!order.kitchenReadyAt) {
        throw new ConflictException(
          `Order ${order.orderNumber} is still pending kitchen preparation`,
        );
      }
      const incompleteUnits = order.prepUnits.filter((u) => u.status !== 'DONE');
      if (incompleteUnits.length > 0) {
        throw new ConflictException(
          `Order ${order.orderNumber} has ${incompleteUnits.length} prep units still in progress`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedDrop = await tx.drop.update({
        where: { id: dropId },
        data: { status: 'DISPATCH_READY' },
      });

      for (const order of drop.orders) {
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            actorId,
            type: 'DISPATCH_READY',
            fromStatus: order.status,
            toStatus: order.status,
            details: { dropId },
          },
        });
      }

      return updatedDrop;
    });
  }

  /**
   * Transition: Dispatch Ready -> Out for Delivery
   * Requires driver assigned and drop to be in DISPATCH_READY.
   */
  async markOutForDelivery(dropId: string, actorId: string) {
    const drop = await this.prisma.drop.findUnique({
      where: { id: dropId },
      include: {
        company: { select: { id: true, defaultDriverId: true } },
        driver: true,
        orders: { select: { id: true, status: true, orderNumber: true } },
      },
    });

    if (!drop) {
      throw new NotFoundException('Delivery drop not found');
    }

    // Idempotent: if already out for delivery or delivered, return safely
    if (drop.status === 'OUT_FOR_DELIVERY' || drop.status === 'DELIVERED') {
      return drop;
    }

    if (drop.status !== 'DISPATCH_READY') {
      throw new ConflictException('Drop must be Dispatch Ready before sending Out for Delivery');
    }

    const effectiveDriverId = drop.driverId ?? drop.company?.defaultDriverId ?? null;
    if (!effectiveDriverId) {
      throw new BadRequestException('Cannot dispatch Out for Delivery without an assigned driver');
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updatedDrop = await tx.drop.update({
        where: { id: dropId },
        data: {
          status: 'OUT_FOR_DELIVERY',
          outForDeliveryAt: now,
          driverId: effectiveDriverId,
        },
      });

      for (const order of drop.orders) {
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            actorId,
            type: 'OUT_FOR_DELIVERY',
            fromStatus: order.status,
            toStatus: order.status,
            details: {
              dropId,
              driverId: effectiveDriverId,
              driverName: drop.driver?.name ?? 'Assigned Driver',
              outForDeliveryAt: now,
            },
          },
        });
      }

      return updatedDrop;
    });
  }

  /**
   * Transition: Out for Delivery -> Delivered
   * Only assigned driver or authorized Admin can perform this.
   * Calculates on-time delivery based on kitchen timezone scheduled delivery time.
   */
  async markDelivered(
    dropId: string,
    user: { id: string; permissions: string[] },
    dto: MarkDeliveredDto,
  ) {
    const drop = await this.prisma.drop.findUnique({
      where: { id: dropId },
      include: {
        orders: { select: { id: true, status: true, orderNumber: true } },
      },
    });

    if (!drop) {
      throw new NotFoundException('Delivery drop not found');
    }

    // Idempotent: if already delivered, return safely
    if (drop.status === 'DELIVERED') {
      return drop;
    }

    const isAdmin = user.permissions.includes('dispatch.manage');

    // Server-side authorization check: Driver must match assigned driver
    if (!isAdmin) {
      if (!drop.driverId || drop.driverId !== user.id) {
        throw new ForbiddenException('You are not authorized to deliver this drop');
      }
    }

    // Status validation: the transition is only valid from OUT_FOR_DELIVERY,
    // even for admin-managed overrides. Arbitrary jumps are rejected.
    if (drop.status !== 'OUT_FOR_DELIVERY') {
      throw new ConflictException('Drop must be Out for Delivery before marking Delivered');
    }

    const now = new Date();

    // Fetch kitchen timezone for on-time calculation
    const setting = await this.prisma.kitchenSetting.findUnique({ where: { id: 1 } });
    const timeZone = setting?.timezone || 'UTC';

    const scheduledUtc = this.getScheduledDeliveryUtc(
      drop.deliveryDate,
      drop.deliveryTime,
      timeZone,
    );

    // Delivered on-time if delivered timestamp is on or before scheduled delivery timestamp
    const deliveredOnTime = now.getTime() <= scheduledUtc.getTime();

    return this.prisma.$transaction(async (tx) => {
      const updatedDrop = await tx.drop.update({
        where: { id: dropId },
        data: {
          status: 'DELIVERED',
          deliveredAt: now,
          deliveredOnTime,
          deliveryNote: dto.deliveryNote ?? null,
          deliveryPhotoUrl: dto.deliveryPhotoUrl ?? null,
        },
      });

      // Update all orders in drop to DELIVERED
      for (const order of drop.orders) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'DELIVERED',
            deliveredAt: now,
          },
        });

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            actorId: user.id,
            type: 'DELIVERED',
            fromStatus: order.status,
            toStatus: 'DELIVERED',
            details: {
              dropId,
              deliveredAt: now,
              deliveredOnTime,
              deliveryNote: dto.deliveryNote,
              deliveryPhotoUrl: dto.deliveryPhotoUrl,
            },
          },
        });
      }

      return updatedDrop;
    });
  }

  /**
   * Driver view: strictly returns only the logged-in driver's drops for TODAY
   * Enforced on server-side using kitchen timezone.
   */
  async getDriverTodayDeliveries(driverId: string) {
    await this.syncConfirmedOrdersToDrops();

    const today = await this.getTodayInKitchenTimezone();

    const drops = await this.prisma.drop.findMany({
      where: {
        driverId,
        deliveryDate: today,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            driverInstructions: true,
            defaultPackaging: true,
          },
        },
        address: {
          select: {
            id: true,
            label: true,
            line1: true,
            line2: true,
            city: true,
            state: true,
            postalCode: true,
          },
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            packaging: true,
            employee: {
              select: {
                id: true,
                name: true,
              },
            },
            lines: {
              select: {
                id: true,
                dishNameSnapshot: true,
                quantity: true,
              },
            },
          },
        },
      },
      orderBy: {
        deliveryTime: 'asc',
      },
    });

    return drops.map((drop) => ({
      id: drop.id,
      company: drop.company,
      address: drop.address,
      deliveryDate: this.formatDateOnly(drop.deliveryDate),
      deliveryTime: drop.deliveryTime,
      status: drop.status,
      outForDeliveryAt: drop.outForDeliveryAt,
      deliveredAt: drop.deliveredAt,
      deliveredOnTime: drop.deliveredOnTime,
      deliveryNote: drop.deliveryNote,
      deliveryPhotoUrl: drop.deliveryPhotoUrl,
      driverInstructions: drop.company.driverInstructions,
      orders: drop.orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        packaging: o.packaging,
        employeeName: o.employee.name,
        items: o.lines.map((l) => `${l.quantity}x ${l.dishNameSnapshot}`),
      })),
    }));
  }
}

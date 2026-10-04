import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { EffectiveMenuService } from '../effective-menu/effective-menu.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AdminOrderOverrideDto,
  CreateOrderDto,
  KitchenHolidayDto,
  KitchenSettingsDto,
  OrderListQueryDto,
  OrderLineDto,
  UpdateOrderDto,
} from './dto/orders.dto.js';

const orderDetail = {
  employee: { select: { id: true, name: true, email: true } },
  company: { select: { id: true, name: true } },
  deliveryAddress: true,
  lines: {
    orderBy: { dishNameSnapshot: 'asc' as const },
    include: {
      combinations: {
        orderBy: { portionSizeNameSnapshot: 'asc' as const },
        include: { options: true },
      },
    },
  },
  events: { orderBy: { createdAt: 'asc' as const } },
};

type EffectiveDish = {
  id: string;
  name: string;
  description: string | null;
  sku: string;
  price: string;
  minimumOrderQuantity: number;
  optionGroups: Array<{
    id: string;
    name: string;
    required: boolean;
    portionSizes: Array<{ id: string; name: string }>;
    options: Array<{
      id: string;
      name: string;
      price: string;
      sizePrices: Array<{ portionSize: { id: string }; extraCharge: string }>;
    }>;
  }>;
};

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private cutoffTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly effectiveMenu: EffectiveMenuService,
  ) {}

  onModuleInit() {
    this.cutoffTimer = setInterval(() => {
      void this.processCutoff(null).catch((error: unknown) => {
        console.error('Automatic order cutoff processing failed', error);
      });
    }, 60_000);
    this.cutoffTimer.unref();
  }

  onModuleDestroy() {
    if (this.cutoffTimer) clearInterval(this.cutoffTimer);
  }

  async create(dto: CreateOrderDto, actorId: string) {
    const context = await this.getEmployeeContext(dto.employeeId);
    const deliveryDate = this.parseDateOnly(dto.deliveryDate);
    const menu = await this.effectiveMenu.getForEmployee(dto.employeeId);
    const built = await this.buildLines(dto.lines, menu.categories);
    const address = await this.resolveAddress(
      context.employee,
      context.company,
      dto.deliveryAddressId,
    );
    const deliveryTime = this.resolveDeliveryTime(
      context.employee,
      context.company,
      dto.deliveryTime,
    );
    const packaging = this.resolvePackaging(
      context.employee,
      context.company,
      dto.packaging,
    );
    await this.validateDelivery(context.company, deliveryDate);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: this.newOrderNumber(),
          employeeId: context.employee.id,
          companyId: context.company.id,
          deliveryDate,
          deliveryTime,
          deliveryAddressId: address.id,
          deliveryAddressSnapshot: this.addressSnapshot(address),
          packaging,
          subtotal: built.subtotal,
          total: built.subtotal,
          lines: { create: built.lines },
          events: {
            create: {
              actorId,
              type: 'CREATED',
              toStatus: 'DRAFT',
              details: { lineCount: built.lines.length },
            },
          },
        },
        include: orderDetail,
      });
      return order;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateDraft(id: string, dto: UpdateOrderDto, actorId: string) {
    const existing = await this.getOrder(id);
    this.assertStatus(existing.status, 'DRAFT', 'Only draft orders can be edited');
    if ((await this.getCutoffInstant(existing.deliveryDate)).getTime() <= Date.now()) {
      throw new ConflictException('Draft orders cannot be edited after cutoff');
    }
    if (dto.lines === undefined && dto.deliveryDate === undefined
      && dto.deliveryTime === undefined && dto.deliveryAddressId === undefined
      && dto.packaging === undefined) {
      throw new BadRequestException('Provide at least one order field to update');
    }
    const context = await this.getEmployeeContext(existing.employeeId);
    const deliveryDate = dto.deliveryDate
      ? this.parseDateOnly(dto.deliveryDate)
      : existing.deliveryDate;
    if ((await this.getCutoffInstant(deliveryDate)).getTime() <= Date.now()) {
      throw new ConflictException('Draft orders cannot be edited after cutoff');
    }
    await this.validateDelivery(context.company, deliveryDate);
    const address = dto.deliveryAddressId !== undefined
      ? await this.resolveAddress(context.employee, context.company, dto.deliveryAddressId)
      : await this.getOrderAddress(existing.deliveryAddressId, context.company.id);
    const deliveryTime = dto.deliveryTime !== undefined
      ? this.resolveDeliveryTime(context.employee, context.company, dto.deliveryTime)
      : existing.deliveryTime;
    const packaging = dto.packaging !== undefined
      ? this.resolvePackaging(context.employee, context.company, dto.packaging)
      : existing.packaging;
    let built: Awaited<ReturnType<OrdersService['buildLines']>> | undefined;
    if (dto.lines) {
      const menu = await this.effectiveMenu.getForEmployee(existing.employeeId);
      built = await this.buildLines(dto.lines, menu.categories);
    }

    return this.prisma.$transaction(async (tx) => {
      const update = await tx.order.updateMany({
        where: { id, status: 'DRAFT' },
        data: {
          deliveryDate,
          deliveryTime,
          deliveryAddressId: address.id,
          deliveryAddressSnapshot: this.addressSnapshot(address),
          packaging,
          ...(built ? { subtotal: built.subtotal, total: built.subtotal } : {}),
          updatedAt: new Date(),
        },
      });
      if (!update.count) throw new ConflictException('Order is no longer a draft');
      if (built) {
        await tx.orderLine.deleteMany({ where: { orderId: id } });
        for (const line of built.lines) {
          await tx.orderLine.create({
            data: { ...line, order: { connect: { id } } },
          });
        }
      }
      await tx.orderEvent.create({
        data: {
          orderId: id,
          actorId,
          type: 'DRAFT_UPDATED',
          details: { linesRepriced: Boolean(built) },
        },
      });
      return tx.order.findUniqueOrThrow({ where: { id }, include: orderDetail });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async place(id: string, actorId: string) {
    const order = await this.getOrder(id);
    this.assertStatus(order.status, 'DRAFT', 'Only draft orders can be placed');
    const context = await this.getEmployeeContext(order.employeeId);
    await this.validateDelivery(context.company, order.deliveryDate);
    const cutoff = await this.getCutoffInstant(order.deliveryDate);
    if (Date.now() >= cutoff.getTime()) throw new ConflictException('The order cutoff has passed');

    return this.transition(id, 'DRAFT', 'PLACED', 'PLACED', actorId, {
      placedAt: new Date(),
    });
  }

  async cancel(id: string, actorId: string) {
    const order = await this.getOrder(id);
    if (order.status !== 'DRAFT' && order.status !== 'PLACED') {
      throw new ConflictException('Only draft or placed orders can be cancelled');
    }
    if (order.status === 'PLACED') {
      const cutoff = await this.getCutoffInstant(order.deliveryDate);
      if (Date.now() >= cutoff.getTime()) {
        throw new ConflictException('Placed orders cannot be cancelled after cutoff');
      }
    }
    return this.transition(
      id,
      order.status,
      'CANCELLED',
      'CANCELLED',
      actorId,
      { cancelledAt: new Date() },
    );
  }

  async returnToDraft(id: string, actorId: string) {
    const order = await this.getOrder(id);
    this.assertStatus(order.status, 'PLACED', 'Only placed orders can be returned to draft');
    const cutoff = await this.getCutoffInstant(order.deliveryDate);
    if (Date.now() >= cutoff.getTime()) {
      throw new ConflictException('Placed orders cannot be edited after cutoff');
    }
    const context = await this.getEmployeeContext(order.employeeId);
    await this.validateDelivery(context.company, order.deliveryDate);
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.order.updateMany({
        where: { id, status: 'PLACED' },
        data: { status: 'DRAFT', placedAt: null },
      });
      if (!changed.count) throw new ConflictException('Order status changed; reload and retry');
      await tx.orderEvent.create({
        data: {
          orderId: id,
          actorId,
          type: 'RETURNED_TO_DRAFT',
          fromStatus: 'PLACED',
          toStatus: 'DRAFT',
        },
      });
      return tx.order.findUniqueOrThrow({ where: { id }, include: orderDetail });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async confirm(id: string, actorId: string) {
    await this.getOrder(id);
    return this.transition(id, 'PLACED', 'CONFIRMED', 'CONFIRMED', actorId, {
      confirmedAt: new Date(),
    });
  }

  async reject(id: string, actorId: string, reason?: string) {
    const order = await this.getOrder(id);
    if (order.status !== 'DRAFT' && order.status !== 'PLACED') {
      throw new ConflictException('Only draft or placed orders can be rejected');
    }
    return this.transition(id, order.status, 'REJECTED', 'REJECTED', actorId, {
      cancelledAt: new Date(),
    }, reason ? { reason } : undefined);
  }

  async operationalOverride(id: string, dto: AdminOrderOverrideDto, actorId: string) {
    if (dto.deliveryTime === undefined
      && dto.deliveryAddressId === undefined
      && dto.packaging === undefined) {
      throw new BadRequestException('Provide at least one operational override');
    }
    const order = await this.getOrder(id);
    if (order.status !== 'CONFIRMED') {
      throw new ConflictException('Operational overrides require a confirmed order');
    }
    const employee = await this.prisma.employee.findUniqueOrThrow({
      where: { id: order.employeeId },
      include: {
        company: {
          include: {
            addresses: { where: { active: true }, orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });
    const address = dto.deliveryAddressId
      ? await this.resolveAddress(employee, employee.company, dto.deliveryAddressId, true)
      : await this.getOrderAddress(order.deliveryAddressId, employee.companyId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id, status: 'CONFIRMED' },
        data: {
          deliveryTime: dto.deliveryTime ?? order.deliveryTime,
          deliveryAddressId: address.id,
          deliveryAddressSnapshot: this.addressSnapshot(address),
          packaging: dto.packaging ?? order.packaging,
        },
      });
      if (!result.count) throw new ConflictException('Order status changed during override');
      await tx.orderEvent.create({
        data: {
          orderId: id,
          actorId,
          type: 'OPERATIONAL_OVERRIDE',
          details: {
            deliveryTime: dto.deliveryTime ?? null,
            deliveryAddressId: dto.deliveryAddressId ?? null,
            packaging: dto.packaging ?? null,
          },
        },
      });
      return tx.order.findUniqueOrThrow({ where: { id }, include: orderDetail });
    });
    return updated;
  }

  async list(query: OrderListQueryDto) {
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status as Prisma.EnumOrderStatusFilter['equals'] } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.fromDate || query.toDate
        ? {
            deliveryDate: {
              ...(query.fromDate ? { gte: this.parseDateOnly(query.fromDate) } : {}),
              ...(query.toDate ? { lte: this.parseDateOnly(query.toDate) } : {}),
            },
          }
        : {}),
      ...(query.invoiced === undefined
        ? {}
        : query.invoiced === 'true'
          ? { invoiceOrder: { isNot: null } }
          : { invoiceOrder: null }),
    };
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true } },
          company: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
        orderBy: [{ deliveryDate: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data, pagination: { page: query.page, limit: query.limit, total } };
  }

  async get(id: string) {
    return this.getOrder(id);
  }

  async getKitchenSettings() {
    return this.prisma.kitchenSetting.findUnique({ where: { id: 1 } });
  }

  async listOrderEmployees() {
    return this.prisma.employee.findMany({
      where: { active: true, company: { active: true } },
      select: {
        id: true,
        name: true,
        email: true,
        canChooseAddress: true,
        canChangeDeliveryTime: true,
        canChangePackaging: true,
        company: { select: { id: true, name: true } },
      },
      orderBy: [{ company: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  async getOrderContext(employeeId: string) {
    const context = await this.getEmployeeContext(employeeId);
    return {
      employee: {
        id: context.employee.id,
        canChooseAddress: context.employee.canChooseAddress,
        canChangeDeliveryTime: context.employee.canChangeDeliveryTime,
        canChangePackaging: context.employee.canChangePackaging,
      },
      company: {
        id: context.company.id,
        name: context.company.name,
        defaultDeliveryTime: context.company.defaultDeliveryTime,
        defaultPackaging: context.company.defaultPackaging,
        addresses: context.company.addresses,
      },
    };
  }

  async updateKitchenSettings(dto: KitchenSettingsDto) {
    this.validateTimezone(dto.timezone ?? 'UTC');
    const weekdays = [
      dto.mondayEnabled,
      dto.tuesdayEnabled,
      dto.wednesdayEnabled,
      dto.thursdayEnabled,
      dto.fridayEnabled,
      dto.saturdayEnabled,
      dto.sundayEnabled,
    ];
    if (weekdays.every((day) => day === false)) {
      throw new BadRequestException('At least one kitchen working day must be enabled');
    }
    return this.prisma.kitchenSetting.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        cutoffTime: dto.cutoffTime,
        cutoffWorkingDays: dto.cutoffWorkingDays,
        timezone: dto.timezone ?? 'UTC',
        mondayEnabled: dto.mondayEnabled ?? true,
        tuesdayEnabled: dto.tuesdayEnabled ?? true,
        wednesdayEnabled: dto.wednesdayEnabled ?? true,
        thursdayEnabled: dto.thursdayEnabled ?? true,
        fridayEnabled: dto.fridayEnabled ?? true,
        saturdayEnabled: dto.saturdayEnabled ?? false,
        sundayEnabled: dto.sundayEnabled ?? false,
      },
      update: {
        cutoffTime: dto.cutoffTime,
        cutoffWorkingDays: dto.cutoffWorkingDays,
        ...(dto.timezone === undefined ? {} : { timezone: dto.timezone }),
        ...this.optionalWeekdayData(dto),
      },
    });
  }

  async listKitchenHolidays() {
    return this.prisma.kitchenHoliday.findMany({ orderBy: { date: 'asc' } });
  }

  async addKitchenHoliday(dto: KitchenHolidayDto) {
    const date = this.parseDateOnly(dto.date);
    const existing = await this.prisma.kitchenHoliday.findUnique({ where: { date } });
    if (existing) throw new ConflictException('A kitchen holiday already exists for this date');
    return this.prisma.kitchenHoliday.create({ data: { date, name: dto.name.trim() } });
  }

  async removeKitchenHoliday(id: string) {
    const deleted = await this.prisma.kitchenHoliday.deleteMany({ where: { id } });
    if (!deleted.count) throw new NotFoundException('Kitchen holiday not found');
    return { deleted: true };
  }

  async processCutoff(actorId: string | null) {
    const now = new Date();
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: ['DRAFT', 'PLACED'] },
        deliveryDate: { gte: this.utcToday() },
      },
      select: { id: true, deliveryDate: true, status: true },
    });
    const eligible: Array<{ id: string; status: 'DRAFT' | 'PLACED' }> = [];
    for (const order of orders) {
      if ((await this.getCutoffInstant(order.deliveryDate)).getTime() <= now.getTime()) {
        if (order.status === 'DRAFT' || order.status === 'PLACED') {
          eligible.push({ id: order.id, status: order.status });
        }
      }
    }
    let confirmed = 0;
    let cancelled = 0;
    for (const order of eligible) {
      const toStatus = order.status === 'PLACED' ? 'CONFIRMED' : 'CANCELLED';
      const changed = await this.prisma.$transaction(async (tx) => {
        const update = await tx.order.updateMany({
          where: { id: order.id, status: order.status },
          data: order.status === 'PLACED'
            ? { status: 'CONFIRMED', confirmedAt: now }
            : { status: 'CANCELLED', cancelledAt: now },
        });
        if (!update.count) return 0;
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            actorId,
            type: order.status === 'PLACED' ? 'CUTOFF_CONFIRMED' : 'CUTOFF_CANCELLED',
            fromStatus: order.status,
            toStatus,
          },
        });
        return 1;
      });
      if (changed && order.status === 'PLACED') confirmed += 1;
      if (changed && order.status === 'DRAFT') cancelled += 1;
    }
    return { processedAt: now, confirmed, cancelled };
  }

  private async buildLines(
    dtoLines: OrderLineDto[],
    menuCategories: Array<{ dishes: EffectiveDish[] }>,
  ) {
    if (!dtoLines.length) throw new BadRequestException('At least one order line is required');
    const menu = new Map(
      menuCategories.flatMap((category) => category.dishes.map((dish) => [dish.id, dish] as const)),
    );
    const seenDishes = new Set<string>();
    let subtotal = new Prisma.Decimal(0);
    const lines: Prisma.OrderLineCreateWithoutOrderInput[] = [];
    for (const line of dtoLines) {
      if (seenDishes.has(line.dishId)) {
        throw new BadRequestException('A dish may only appear once; use combinations for variation');
      }
      seenDishes.add(line.dishId);
      const dish = menu.get(line.dishId);
      if (!dish) throw new BadRequestException('Dish is not available on this employee menu');
      if (line.quantity < dish.minimumOrderQuantity) {
        throw new BadRequestException(`${dish.name} minimum order quantity is ${dish.minimumOrderQuantity}`);
      }
      if (!line.combinations?.length) {
        throw new BadRequestException(`${dish.name} requires at least one combination`);
      }
      const combinationQuantity = line.combinations.reduce((sum, combination) => sum + combination.quantity, 0);
      if (combinationQuantity !== line.quantity) {
        throw new BadRequestException(`${dish.name} combination quantities must equal line quantity`);
      }
      const groupMap = new Map(dish.optionGroups.map((group) => [group.id, group]));
      const combinations: Prisma.OrderCombinationCreateWithoutOrderLineInput[] = [];
      let lineTotal = new Prisma.Decimal(0);
      for (const combination of line.combinations) {
        const chosenGroups = new Set<string>();
        const chosenOptions: Prisma.OrderCombinationOptionCreateWithoutCombinationInput[] = [];
        let combinationUnit = new Prisma.Decimal(dish.price);
        for (const selection of combination.selections ?? []) {
          if (chosenGroups.has(selection.groupId)) {
            throw new BadRequestException('Only one option can be selected per option group');
          }
          chosenGroups.add(selection.groupId);
          const group = groupMap.get(selection.groupId);
          const option = group?.options.find(({ id }) => id === selection.optionId);
          if (!group || !option) {
            throw new BadRequestException('Selected option is not available for this dish and group');
          }
          const size = combination.portionSizeId;
          const supportsSizes = group.portionSizes.length > 0;
          let extraCharge = new Prisma.Decimal(0);
          if (supportsSizes) {
            if (!size || !group.portionSizes.some(({ id }) => id === size)) {
              throw new BadRequestException(`Select a valid portion size for ${group.name}`);
            }
            const sizePrice = option.sizePrices.find(({ portionSize }) => portionSize.id === size);
            if (!sizePrice) {
              throw new BadRequestException(`${option.name} is unavailable for the selected portion size`);
            }
            extraCharge = new Prisma.Decimal(sizePrice.extraCharge);
          }
          const optionPrice = new Prisma.Decimal(option.price);
          const selectedPrice = optionPrice.add(extraCharge);
          combinationUnit = combinationUnit.add(selectedPrice);
          chosenOptions.push({
            option: { connect: { id: option.id } },
            optionNameSnapshot: option.name,
            optionGroupNameSnapshot: group.name,
            price: selectedPrice,
          });
        }
        const missingRequired = dish.optionGroups.find(
          (group) => group.required && !chosenGroups.has(group.id),
        );
        if (missingRequired) {
          throw new BadRequestException(`An option is required for ${missingRequired.name}`);
        }
        const sizeGroup = dish.optionGroups.find(
          (group) => chosenGroups.has(group.id)
            && group.portionSizes.some(({ id }) => id === combination.portionSizeId),
        );
        const selectedSize = sizeGroup?.portionSizes.find(({ id }) => id === combination.portionSizeId);
        if (combination.portionSizeId && !selectedSize) {
          throw new BadRequestException('Selected portion size is not available for this dish');
        }
        if (!combination.portionSizeId && dish.optionGroups.some(
          (group) => chosenGroups.has(group.id) && group.portionSizes.length > 0,
        )) {
          throw new BadRequestException('Select a portion size for the selected option group');
        }
        const totalPrice = combinationUnit.mul(combination.quantity);
        lineTotal = lineTotal.add(totalPrice);
        combinations.push({
          quantity: combination.quantity,
          ...(selectedSize ? { portionSize: { connect: { id: selectedSize.id } } } : {}),
          portionSizeNameSnapshot: selectedSize?.name ?? 'Standard',
          unitPrice: combinationUnit,
          totalPrice,
          options: { create: chosenOptions },
        });
      }
      subtotal = subtotal.add(lineTotal);
      lines.push({
        dish: { connect: { id: dish.id } },
        dishNameSnapshot: dish.name,
        dishSkuSnapshot: dish.sku,
        quantity: line.quantity,
        unitPrice: new Prisma.Decimal(dish.price),
        lineTotal,
        combinations: { create: combinations },
      });
    }
    return { lines, subtotal };
  }

  private async getEmployeeContext(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        company: {
          include: {
            addresses: { where: { active: true }, orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });
    if (!employee || !employee.active) throw new NotFoundException('Active employee not found');
    if (!employee.company.active) throw new BadRequestException('Employee company is inactive');
    return { employee, company: employee.company };
  }

  private async resolveAddress(
    employee: {
      canChooseAddress: boolean;
    },
    company: {
      addresses: Array<{
        id: string;
        label: string;
        line1: string;
        line2: string | null;
        city: string;
        state: string;
        postalCode: string;
        country: string;
      }>;
    },
    requestedId?: string,
    override = false,
  ) {
    if (requestedId && !employee.canChooseAddress && !override) {
      throw new BadRequestException('Employee is not permitted to choose a delivery address');
    }
    if (requestedId) {
      const address = company.addresses.find((item) => item.id === requestedId);
      if (!address) throw new BadRequestException('Delivery address is not active for this company');
      return address;
    }
    if (employee.canChooseAddress) {
      throw new BadRequestException('Choose an active delivery address');
    }
    if (company.addresses.length !== 1) {
      throw new BadRequestException('Company must have exactly one active address for this employee');
    }
    return company.addresses[0];
  }

  private async getOrderAddress(addressId: string | null, companyId: string) {
    if (!addressId) throw new BadRequestException('Order has no delivery address');
    const address = await this.prisma.companyAddress.findFirst({
      where: { id: addressId, companyId, active: true },
    });
    if (!address) throw new BadRequestException('Order delivery address is no longer active');
    return address;
  }

  private resolveDeliveryTime(
    employee: { canChangeDeliveryTime: boolean },
    company: { defaultDeliveryTime: string | null },
    requested?: string,
  ) {
    const defaultTime = company.defaultDeliveryTime;
    if (!employee.canChangeDeliveryTime) {
      if (requested && requested !== defaultTime) {
        throw new BadRequestException('Employee is not permitted to change delivery time');
      }
      if (!defaultTime) throw new BadRequestException('Company has no default delivery time');
      return defaultTime;
    }
    const time = requested ?? defaultTime;
    if (!time) throw new BadRequestException('Delivery time is required');
    return time;
  }

  private resolvePackaging(
    employee: { canChangePackaging: boolean },
    company: { defaultPackaging: string | null },
    requested?: string,
  ) {
    if (!employee.canChangePackaging) {
      if (requested && requested !== company.defaultPackaging) {
        throw new BadRequestException('Employee is not permitted to change packaging');
      }
      if (!company.defaultPackaging) throw new BadRequestException('Company has no default packaging');
      return company.defaultPackaging;
    }
    const packaging = requested ?? company.defaultPackaging;
    if (!packaging?.trim()) throw new BadRequestException('Packaging is required');
    return packaging.trim();
  }

  private async validateDelivery(
    company: {
      id: string;
      mondayEnabled: boolean;
      tuesdayEnabled: boolean;
      wednesdayEnabled: boolean;
      thursdayEnabled: boolean;
      fridayEnabled: boolean;
      saturdayEnabled: boolean;
      sundayEnabled: boolean;
    },
    deliveryDate: Date,
  ) {
    const dayName = this.weekdayName(deliveryDate);
    if (!this.isWeekdayEnabled(company, dayName)) {
      throw new BadRequestException('Company is not scheduled for delivery on this weekday');
    }
    const companyHoliday = await this.prisma.companyHoliday.findUnique({
      where: { companyId_date: { companyId: company.id, date: deliveryDate } },
    });
    if (companyHoliday) throw new BadRequestException('Company is closed on the selected delivery date');
    const setting = await this.getSettingsOrDefault();
    if (!this.isWeekdayEnabled(setting, dayName)) {
      throw new BadRequestException('Kitchen is closed on the selected delivery weekday');
    }
    const kitchenHoliday = await this.prisma.kitchenHoliday.findUnique({
      where: { date: deliveryDate },
    });
    if (kitchenHoliday) throw new BadRequestException('Kitchen is closed on the selected delivery date');
  }

  private async getCutoffInstant(deliveryDate: Date) {
    const settings = await this.getSettingsOrDefault();
    if (settings.cutoffWorkingDays > 0 && ![
      settings.mondayEnabled,
      settings.tuesdayEnabled,
      settings.wednesdayEnabled,
      settings.thursdayEnabled,
      settings.fridayEnabled,
      settings.saturdayEnabled,
      settings.sundayEnabled,
    ].some(Boolean)) {
      throw new BadRequestException('Kitchen calendar has no working days configured');
    }
    let cutoffDate = this.dateOnlyParts(deliveryDate);
    let remaining = settings.cutoffWorkingDays;
    while (remaining > 0) {
      cutoffDate = this.addDays(cutoffDate, -1);
      const date = this.partsToDate(cutoffDate);
      const name = this.weekdayName(date);
      const holiday = await this.prisma.kitchenHoliday.findUnique({ where: { date } });
      if (this.isWeekdayEnabled(settings, name) && !holiday) remaining -= 1;
    }
    const [hour, minute] = settings.cutoffTime.split(':').map(Number);
    return this.zonedDateToUtc(
      { ...cutoffDate, hour, minute },
      settings.timezone,
    );
  }

  private async getSettingsOrDefault() {
    return await this.prisma.kitchenSetting.findUnique({ where: { id: 1 } }) ?? {
      id: 1,
      cutoffTime: '15:00',
      cutoffWorkingDays: 1,
      mondayEnabled: true,
      tuesdayEnabled: true,
      wednesdayEnabled: true,
      thursdayEnabled: true,
      fridayEnabled: true,
      saturdayEnabled: false,
      sundayEnabled: false,
      timezone: 'UTC',
    };
  }

  private async transition(
    id: string,
    fromStatus: 'DRAFT' | 'PLACED',
    toStatus: 'PLACED' | 'CONFIRMED' | 'CANCELLED' | 'REJECTED',
    eventType: string,
    actorId: string,
    timestamps: Prisma.OrderUpdateInput,
    details?: Prisma.InputJsonValue,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.order.updateMany({
        where: { id, status: fromStatus },
        data: { status: toStatus, ...timestamps },
      });
      if (!changed.count) throw new ConflictException('Order status changed; reload and retry');
      await tx.orderEvent.create({
        data: {
          orderId: id,
          actorId,
          type: eventType,
          fromStatus,
          toStatus,
          ...(details === undefined ? {} : { details }),
        },
      });
      return tx.order.findUniqueOrThrow({ where: { id }, include: orderDetail });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async getOrder(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderDetail });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private parseDateOnly(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10))) {
      throw new BadRequestException('Date must use YYYY-MM-DD format');
    }
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    const result = new Date(Date.UTC(year, month - 1, day));
    if (result.getUTCFullYear() !== year || result.getUTCMonth() !== month - 1 || result.getUTCDate() !== day) {
      throw new BadRequestException('Invalid calendar date');
    }
    return result;
  }

  private dateOnlyParts(value: Date) {
    return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
  }

  private partsToDate(parts: { year: number; month: number; day: number }) {
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  }

  private addDays(parts: { year: number; month: number; day: number }, count: number) {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + count));
    return this.dateOnlyParts(date);
  }

  private zonedDateToUtc(
    target: { year: number; month: number; day: number; hour: number; minute: number },
    timeZone: string,
  ) {
    this.validateTimezone(timeZone);
    const desiredUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute);
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
        formatter.formatToParts(new Date(guess))
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

  private validateTimezone(timezone: string) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      throw new BadRequestException('Invalid timezone');
    }
  }

  private utcToday() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private weekdayName(date: Date) {
    return ([
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ] as const)[date.getUTCDay()];
  }

  private isWeekdayEnabled(
    calendar: {
      mondayEnabled: boolean;
      tuesdayEnabled: boolean;
      wednesdayEnabled: boolean;
      thursdayEnabled: boolean;
      fridayEnabled: boolean;
      saturdayEnabled: boolean;
      sundayEnabled: boolean;
    },
    weekday: ReturnType<OrdersService['weekdayName']>,
  ) {
    const enabled: Record<ReturnType<OrdersService['weekdayName']>, boolean> = {
      monday: calendar.mondayEnabled,
      tuesday: calendar.tuesdayEnabled,
      wednesday: calendar.wednesdayEnabled,
      thursday: calendar.thursdayEnabled,
      friday: calendar.fridayEnabled,
      saturday: calendar.saturdayEnabled,
      sunday: calendar.sundayEnabled,
    };
    return enabled[weekday];
  }

  private addressSnapshot(address: any) {
    return {
      id: address.id,
      label: address.label,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
    } satisfies Prisma.InputJsonObject;
  }

  private newOrderNumber() {
    return `ORD-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private optionalWeekdayData(dto: KitchenSettingsDto) {
    return Object.fromEntries(
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        .flatMap((day) => {
          const key = `${day}Enabled` as keyof KitchenSettingsDto;
          return dto[key] === undefined ? [] : [[key, dto[key]]];
        }),
    );
  }

  private assertStatus(actual: string, expected: string, message: string) {
    if (actual !== expected) throw new ConflictException(message);
  }
}

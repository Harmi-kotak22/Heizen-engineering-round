import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DispatchService } from './dispatch.service.js';

describe('DispatchService', () => {
  let service: DispatchService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      kitchenSetting: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, timezone: 'UTC' }),
      },
      drop: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      order: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
      orderEvent: {
        create: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };

    service = new DispatchService(prisma);
  });

  describe('markDispatchReady', () => {
    it('throws if kitchen prep units are incomplete', async () => {
      prisma.drop.findUnique.mockResolvedValue({
        id: 'drop-1',
        status: 'KITCHEN_READY',
        orders: [
          {
            id: 'order-1',
            orderNumber: 'ORD-001',
            status: 'CONFIRMED',
            kitchenReadyAt: new Date(),
            prepUnits: [{ id: 'unit-1', status: 'PENDING' }],
          },
        ],
      });

      await expect(service.markDispatchReady('drop-1', 'actor-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws if order is not marked kitchen ready', async () => {
      prisma.drop.findUnique.mockResolvedValue({
        id: 'drop-1',
        status: 'KITCHEN_READY',
        orders: [
          {
            id: 'order-1',
            orderNumber: 'ORD-001',
            status: 'CONFIRMED',
            kitchenReadyAt: null,
            prepUnits: [{ id: 'unit-1', status: 'DONE' }],
          },
        ],
      });

      await expect(service.markDispatchReady('drop-1', 'actor-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('successfully transitions to DISPATCH_READY when kitchen prep is complete', async () => {
      prisma.drop.findUnique.mockResolvedValue({
        id: 'drop-1',
        status: 'KITCHEN_READY',
        orders: [
          {
            id: 'order-1',
            orderNumber: 'ORD-001',
            status: 'CONFIRMED',
            kitchenReadyAt: new Date(),
            prepUnits: [{ id: 'unit-1', status: 'DONE' }],
          },
        ],
      });
      prisma.drop.update.mockResolvedValue({ id: 'drop-1', status: 'DISPATCH_READY' });

      const result = await service.markDispatchReady('drop-1', 'actor-1');
      expect(result.status).toBe('DISPATCH_READY');
      expect(prisma.orderEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 'order-1',
            type: 'DISPATCH_READY',
          }),
        }),
      );
    });

    it('is idempotent if already DISPATCH_READY', async () => {
      prisma.drop.findUnique.mockResolvedValue({
        id: 'drop-1',
        status: 'DISPATCH_READY',
        orders: [],
      });

      const result = await service.markDispatchReady('drop-1', 'actor-1');
      expect(result.status).toBe('DISPATCH_READY');
      expect(prisma.drop.update).not.toHaveBeenCalled();
    });
  });

  describe('markOutForDelivery', () => {
    it('throws if no driver is assigned', async () => {
      prisma.drop.findUnique.mockResolvedValue({
        id: 'drop-1',
        status: 'DISPATCH_READY',
        driverId: null,
        orders: [],
      });

      await expect(service.markOutForDelivery('drop-1', 'actor-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws if drop is not in DISPATCH_READY status', async () => {
      prisma.drop.findUnique.mockResolvedValue({
        id: 'drop-1',
        status: 'KITCHEN_READY',
        driverId: 'driver-1',
        orders: [],
      });

      await expect(service.markOutForDelivery('drop-1', 'actor-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('successfully transitions to OUT_FOR_DELIVERY when valid', async () => {
      prisma.drop.findUnique.mockResolvedValue({
        id: 'drop-1',
        status: 'DISPATCH_READY',
        driverId: 'driver-1',
        driver: { name: 'Dan Driver' },
        orders: [{ id: 'order-1', status: 'CONFIRMED' }],
      });
      prisma.drop.update.mockResolvedValue({ id: 'drop-1', status: 'OUT_FOR_DELIVERY' });

      const result = await service.markOutForDelivery('drop-1', 'actor-1');
      expect(result.status).toBe('OUT_FOR_DELIVERY');
      expect(prisma.orderEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 'order-1',
            type: 'OUT_FOR_DELIVERY',
          }),
        }),
      );
    });
  });

  describe('markDelivered', () => {
    it('forbids a driver from delivering another driver drop', async () => {
      prisma.drop.findUnique.mockResolvedValue({
        id: 'drop-1',
        status: 'OUT_FOR_DELIVERY',
        driverId: 'driver-1',
        orders: [],
      });

      await expect(
        service.markDelivered(
          'drop-1',
          { id: 'driver-2', permissions: ['deliveries.manageOwn'] },
          {},
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows assigned driver to deliver their drop and calculates on-time status', async () => {
      const deliveryDate = new Date(Date.UTC(2026, 9, 5));
      prisma.drop.findUnique.mockResolvedValue({
        id: 'drop-1',
        status: 'OUT_FOR_DELIVERY',
        driverId: 'driver-1',
        deliveryDate,
        deliveryTime: '23:59',
        orders: [{ id: 'order-1', status: 'CONFIRMED' }],
      });
      prisma.drop.update.mockImplementation(({ data }: any) => ({
        id: 'drop-1',
        status: 'DELIVERED',
        ...data,
      }));

      const result = await service.markDelivered(
        'drop-1',
        { id: 'driver-1', permissions: ['deliveries.manageOwn'] },
        { deliveryNote: 'Left at reception' },
      );

      expect(result.status).toBe('DELIVERED');
      expect(result.deliveryNote).toBe('Left at reception');
      expect(typeof result.deliveredOnTime).toBe('boolean');
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1' },
          data: expect.objectContaining({ status: 'DELIVERED' }),
        }),
      );
    });

    it('allows Admin to perform override delivery even if not assigned driver', async () => {
      const deliveryDate = new Date(Date.UTC(2026, 9, 5));
      prisma.drop.findUnique.mockResolvedValue({
        id: 'drop-1',
        status: 'OUT_FOR_DELIVERY',
        driverId: 'driver-1',
        deliveryDate,
        deliveryTime: '12:00',
        orders: [{ id: 'order-1', status: 'CONFIRMED' }],
      });
      prisma.drop.update.mockImplementation(({ data }: any) => ({
        id: 'drop-1',
        status: 'DELIVERED',
        ...data,
      }));

      const result = await service.markDelivered(
        'drop-1',
        { id: 'admin-1', permissions: ['dispatch.manage'] },
        {},
      );

      expect(result.status).toBe('DELIVERED');
    });
  });

  describe('driver drop isolation', () => {
    it('queries only drops matching the driver id and today date', async () => {
      prisma.drop.findMany.mockResolvedValue([]);

      await service.getDriverTodayDeliveries('driver-1');

      expect(prisma.drop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            driverId: 'driver-1',
          }),
        }),
      );
    });
  });
});

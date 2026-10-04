import type { EffectiveMenuService } from '../effective-menu/effective-menu.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrdersService } from './orders.service.js';

describe('OrdersService kitchen board', () => {
  it('orders prep units by a field present on the kitchen prep unit model', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const service = new OrdersService(
      { kitchenPrepUnit: { findMany, count } } as unknown as PrismaService,
      {} as EffectiveMenuService,
    );

    await service.listKitchenBoard({
      page: 1,
      limit: 50,
      deliveryDate: '2026-10-04',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { order: { deliveryDate: 'asc' } },
          { order: { deliveryTime: 'asc' } },
          { station: { name: 'asc' } },
          { id: 'asc' },
        ],
      }),
    );
  });
});

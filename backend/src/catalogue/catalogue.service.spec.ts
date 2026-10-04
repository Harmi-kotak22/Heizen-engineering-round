import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CatalogueService } from './catalogue.service.js';
import { UpdateDishDto } from './dto/catalogue.dto.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('CatalogueService pagination and atomic updates', () => {
  function createService(prisma: object) {
    return new CatalogueService(prisma as PrismaService);
  }

  it('uses default pagination for categories and reports totals', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'category-1' }]);
    const count = vi.fn().mockResolvedValue(45);
    const service = createService({ category: { findMany, count } });

    await expect(service.listCategories()).resolves.toEqual({
      data: [{ id: 'category-1' }],
      pagination: { page: 1, limit: 20, total: 45, totalPages: 3 },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it('applies requested dish pagination while retaining filters', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(41);
    const service = createService({ dish: { findMany, count } });

    const result = await service.listDishes({
      active: false,
      search: 'soup',
      page: 3,
      limit: 10,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: false,
          OR: [
            { name: { contains: 'soup', mode: 'insensitive' } },
            { sku: { contains: 'soup', mode: 'insensitive' } },
          ],
        }),
        skip: 20,
        take: 10,
      }),
    );
    expect(result.pagination).toEqual({
      page: 3,
      limit: 10,
      total: 41,
      totalPages: 5,
    });
  });

  it('applies requested pagination to options', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(7);
    const service = createService({ option: { findMany, count } });

    const result = await service.listOptions(true, 'cheese', 2, 3);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          active: true,
          name: { contains: 'cheese', mode: 'insensitive' },
        },
        skip: 3,
        take: 3,
      }),
    );
    expect(result.pagination.totalPages).toBe(3);
  });

  it('executes all dish and relationship writes inside one transaction', async () => {
    const tx = {
      dish: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ id: 'dish-1', sku: 'old-sku' })
          .mockResolvedValueOnce({ id: 'dish-1', sku: 'new-sku' }),
        update: vi.fn().mockResolvedValue({ id: 'dish-1' }),
      },
      allergen: { findMany: vi.fn().mockResolvedValue([{ id: 'allergen-1' }]) },
      dietaryTag: { findMany: vi.fn().mockResolvedValue([{ id: 'tag-1' }]) },
      category: { findMany: vi.fn().mockResolvedValue([{ id: 'category-1' }]) },
      dishAllergen: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      dishDietaryTag: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockRejectedValue(new Error('Relationship write failed')),
      },
      categoryDish: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      station: { findUnique: vi.fn().mockResolvedValue({ id: 'station-1' }) },
    };
    const transaction = vi.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    const service = createService({ $transaction: transaction });

    await expect(
      service.updateDish('dish-1', {
        name: 'Updated dish',
        sku: 'new-sku',
        allergenIds: ['allergen-1'],
        dietaryTagIds: ['tag-1'],
        categoryIds: ['category-1'],
      }),
    ).rejects.toThrow('Relationship write failed');

    expect(transaction).toHaveBeenCalledOnce();
    expect(tx.dish.update).toHaveBeenCalledOnce();
    expect(tx.dishAllergen.createMany).toHaveBeenCalledOnce();
    expect(tx.dishDietaryTag.createMany).toHaveBeenCalledOnce();
    expect(tx.categoryDish.createMany).not.toHaveBeenCalled();
  });

  it('persists all dish relationships on a successful transactional update', async () => {
    const updatedDish = { id: 'dish-1', name: 'Updated dish' };
    const tx = {
      dish: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ id: 'dish-1', sku: 'old-sku' })
          .mockResolvedValueOnce(updatedDish),
        update: vi.fn().mockResolvedValue(updatedDish),
      },
      allergen: { findMany: vi.fn().mockResolvedValue([{ id: 'allergen-1' }]) },
      dietaryTag: { findMany: vi.fn().mockResolvedValue([{ id: 'tag-1' }]) },
      category: { findMany: vi.fn().mockResolvedValue([{ id: 'category-1' }]) },
      dishAllergen: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      dishDietaryTag: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      categoryDish: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      station: { findUnique: vi.fn() },
    };
    const transaction = vi.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    const service = createService({ $transaction: transaction });

    await expect(
      service.updateDish('dish-1', {
        name: 'Updated dish',
        allergenIds: ['allergen-1'],
        dietaryTagIds: ['tag-1'],
        categoryIds: ['category-1'],
      }),
    ).resolves.toEqual(updatedDish);

    expect(tx.dish.update).toHaveBeenCalledOnce();
    expect(tx.dishAllergen.createMany).toHaveBeenCalledOnce();
    expect(tx.dishDietaryTag.createMany).toHaveBeenCalledOnce();
    expect(tx.categoryDish.createMany).toHaveBeenCalledOnce();
  });

  it('rolls back a size-inconsistent option addition through its transaction', async () => {
    const tx = {
      optionGroup: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ id: 'group-1' })
          .mockResolvedValueOnce({
            id: 'group-1',
            sizes: [{ portionSizeId: 'size-1' }],
            options: [{ optionId: 'option-1', sizePrices: [] }],
          }),
      },
      option: { findUnique: vi.fn().mockResolvedValue({ id: 'option-1' }) },
      optionGroupOption: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const transaction = vi.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    const service = createService({ $transaction: transaction });

    await expect(
      service.addOptionToGroup('group-1', { optionId: 'option-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction).toHaveBeenCalledOnce();
    expect(tx.optionGroupOption.create).toHaveBeenCalledOnce();
    expect(tx.optionGroup.findUnique).toHaveBeenCalledTimes(2);
  });

  it('rejects adding a portion size that lacks prices for existing options', async () => {
    const tx = {
      optionGroup: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ id: 'group-1' })
          .mockResolvedValueOnce({
            id: 'group-1',
            sizes: [{ portionSizeId: 'size-1' }],
            options: [{ optionId: 'option-1', sizePrices: [] }],
          }),
      },
      portionSize: { findUnique: vi.fn().mockResolvedValue({ id: 'size-1' }) },
      optionGroupSize: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const transaction = vi.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    const service = createService({ $transaction: transaction });

    await expect(
      service.addPortionSizeToGroup('group-1', { portionSizeId: 'size-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction).toHaveBeenCalledOnce();
    expect(tx.optionGroupSize.create).toHaveBeenCalledOnce();
  });

  it('rejects active updates through UpdateDishDto', async () => {
    const dto = plainToInstance(UpdateDishDto, { active: false });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('active');
  });
});

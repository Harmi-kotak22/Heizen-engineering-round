import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreatePricingTierDto, SetPricingItemPriceDto, UpdatePricingTierDto } from './dto/pricing.dto.js';

export type PriceSource = 'MANUAL' | 'DERIVED' | 'OVERRIDE' | 'MISSING';

export type ResolvedItemPrice = {
  price: Prisma.Decimal | null;
  source: PriceSource;
};

export type PricingItemInput = {
  id: string;
  costPrice: Prisma.Decimal | string;
};

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async listTiers() {
    return this.prisma.pricingTier.findMany({
      orderBy: { name: 'asc' },
      include: { derivationSource: true },
    });
  }

  async getTier(id: string) {
    const tier = await this.prisma.pricingTier.findUnique({
      where: { id },
      include: { derivationSource: true },
    });

    if (!tier) {
      throw new NotFoundException('Pricing tier not found');
    }

    return tier;
  }

  async createTier(dto: CreatePricingTierDto) {
    const name = this.normalizeTierName(dto.name);
    const existing = await this.prisma.pricingTier.findUnique({
      where: { name },
    });

    if (existing) {
      throw new BadRequestException('Pricing tier already exists');
    }

    const nextTier = await this.validateTierConfiguration(
      null,
      dto.derivationType ?? 'NONE',
      dto.derivationSourceTierId ?? null,
      dto.derivationFactor ?? null,
    );

    return this.prisma.$transaction(async (tx) => {
      const defaultTier = await tx.pricingTier.findFirst({
        where: { isDefault: true },
      });
      const isDefault = dto.isDefault === true || !defaultTier;

      if (isDefault && defaultTier) {
        await tx.pricingTier.update({
          where: { id: defaultTier.id },
          data: { isDefault: false },
        });
      }

      return tx.pricingTier.create({
        data: {
          name,
          isDefault,
          derivationType: nextTier.derivationType,
          derivationSourceTierId: nextTier.derivationSourceTierId,
          derivationFactor: nextTier.derivationFactor,
        },
        include: { derivationSource: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateTier(id: string, dto: UpdatePricingTierDto) {
    const existing = await this.prisma.pricingTier.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Pricing tier not found');
    }

    let name = existing.name;
    if (dto.name) {
      name = this.normalizeTierName(dto.name);
      const duplicate = await this.prisma.pricingTier.findUnique({
        where: { name },
      });
      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException('Pricing tier already exists');
      }
    }

    const nextType = dto.derivationType ?? existing.derivationType;
    const existingFactor = existing.derivationFactor?.toString() ?? null;
    const typeChanged = dto.derivationType !== undefined
      && dto.derivationType !== existing.derivationType;
    const nextFactor = dto.derivationFactor ?? (typeChanged
      ? null
      : nextType === 'TIER_PERCENTAGE' && existingFactor !== null
        ? this.toDecimal(existingFactor).mul(100).toString()
        : existingFactor);
    const nextTier = await this.validateTierConfiguration(
      id,
      nextType,
      dto.derivationSourceTierId ?? existing.derivationSourceTierId,
      nextFactor,
    );

    return this.prisma.pricingTier.update({
      where: { id },
      data: {
        name,
        derivationType: nextTier.derivationType,
        derivationSourceTierId: nextTier.derivationSourceTierId,
        derivationFactor: nextTier.derivationFactor,
      },
      include: { derivationSource: true },
    });
  }

  async setDefaultTier(id: string) {
    const tier = await this.prisma.pricingTier.findUnique({ where: { id } });
    if (!tier) {
      throw new NotFoundException('Pricing tier not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const currentDefault = await tx.pricingTier.findFirst({
        where: { isDefault: true },
      });

      if (currentDefault && currentDefault.id !== id) {
        await tx.pricingTier.update({
          where: { id: currentDefault.id },
          data: { isDefault: false },
        });
      }

      return tx.pricingTier.update({
        where: { id },
        data: { isDefault: true },
        include: { derivationSource: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async listTierDishCoverage(tierId: string) {
    await this.ensureTierExists(tierId);

    const dishes = await this.prisma.dish.findMany({
      orderBy: { name: 'asc' },
      include: { station: true },
    });

    return Promise.all(
      dishes.map(async (dish) => {
        const resolved = await this.resolveDishPrice(tierId, dish.id);
        return {
          id: dish.id,
          name: dish.name,
          sku: dish.sku,
          costPrice: this.formatMoney(dish.costPrice),
          price: this.formatMoney(resolved.price),
          source: resolved.source,
        };
      }),
    );
  }

  async listTierOptionCoverage(tierId: string) {
    await this.ensureTierExists(tierId);

    const options = await this.prisma.option.findMany({
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      options.map(async (option) => {
        const resolved = await this.resolveOptionPrice(tierId, option.id);
        return {
          id: option.id,
          name: option.name,
          costPrice: this.formatMoney(option.costPrice),
          price: this.formatMoney(resolved.price),
          source: resolved.source,
        };
      }),
    );
  }

  async resolveDishPrice(tierId: string, dishId: string): Promise<ResolvedItemPrice> {
    const [tier, dish] = await Promise.all([
      this.prisma.pricingTier.findUnique({ where: { id: tierId } }),
      this.prisma.dish.findUnique({ where: { id: dishId } }),
    ]);

    if (!tier) {
      throw new NotFoundException('Pricing tier not found');
    }

    if (!dish) {
      throw new NotFoundException('Dish not found');
    }

    const row = await this.prisma.dishPrice.findUnique({
      where: {
        dishId_pricingTierId: {
          dishId,
          pricingTierId: tierId,
        },
      },
    });

    if (row?.source === 'OVERRIDE') {
      return { price: row.price, source: 'OVERRIDE' };
    }

    if (row && (row.source === 'MANUAL' || row.source === 'DERIVED')) {
      return { price: row.price, source: row.source };
    }

    if (tier.derivationType !== 'NONE') {
      const derived = await this.calculateDishDerivation(tier, dish);
      if (derived) {
        return { price: derived, source: 'DERIVED' };
      }
      return { price: null, source: 'MISSING' };
    }

    return { price: null, source: 'MISSING' };
  }

  async resolveOptionPrice(
    tierId: string,
    optionId: string,
  ): Promise<ResolvedItemPrice> {
    const [tier, option] = await Promise.all([
      this.prisma.pricingTier.findUnique({ where: { id: tierId } }),
      this.prisma.option.findUnique({ where: { id: optionId } }),
    ]);

    if (!tier) {
      throw new NotFoundException('Pricing tier not found');
    }

    if (!option) {
      throw new NotFoundException('Option not found');
    }

    const row = await this.prisma.optionPrice.findUnique({
      where: {
        optionId_pricingTierId: {
          optionId,
          pricingTierId: tierId,
        },
      },
    });

    if (row?.source === 'OVERRIDE') {
      return { price: row.price, source: 'OVERRIDE' };
    }

    if (row && (row.source === 'MANUAL' || row.source === 'DERIVED')) {
      return { price: row.price, source: row.source };
    }

    if (tier.derivationType !== 'NONE') {
      const derived = await this.calculateOptionDerivation(tier, option);
      if (derived) {
        return { price: derived, source: 'DERIVED' };
      }
      return { price: null, source: 'MISSING' };
    }

    return { price: null, source: 'MISSING' };
  }

  async resolveDishPrices(
    tierId: string,
    items: PricingItemInput[],
  ): Promise<Map<string, ResolvedItemPrice>> {
    return this.resolvePricesInBatch(tierId, 'dish', items);
  }

  async resolveOptionPrices(
    tierId: string,
    items: PricingItemInput[],
  ): Promise<Map<string, ResolvedItemPrice>> {
    return this.resolvePricesInBatch(tierId, 'option', items);
  }

  private async resolvePricesInBatch(
    tierId: string,
    itemType: 'dish' | 'option',
    items: PricingItemInput[],
  ): Promise<Map<string, ResolvedItemPrice>> {
    const tier = await this.prisma.pricingTier.findUnique({ where: { id: tierId } });
    if (!tier) throw new NotFoundException('Pricing tier not found');
    if (!items.length) return new Map();

    const tiers = await this.prisma.pricingTier.findMany({
      select: {
        id: true,
        derivationType: true,
        derivationSourceTierId: true,
        derivationFactor: true,
      },
    });
    const tierById = new Map(tiers.map((item) => [item.id, item]));
    const neededTierIds = new Set<string>();
    const collectChain = (id: string) => {
      if (neededTierIds.has(id)) return;
      neededTierIds.add(id);
      const current = tierById.get(id);
      if (current?.derivationType === 'TIER_PERCENTAGE' && current.derivationSourceTierId) {
        collectChain(current.derivationSourceTierId);
      }
    };
    collectChain(tierId);

    const ids = items.map((item) => item.id);
    const rows = itemType === 'dish'
      ? await this.prisma.dishPrice.findMany({
          where: { pricingTierId: { in: [...neededTierIds] }, dishId: { in: ids } },
        })
      : await this.prisma.optionPrice.findMany({
          where: { pricingTierId: { in: [...neededTierIds] }, optionId: { in: ids } },
        });
    const priceByKey = new Map<string, { price: Prisma.Decimal; source: string }>();
    for (const row of rows) {
      const itemId = itemType === 'dish'
        ? (row as { dishId: string }).dishId
        : (row as { optionId: string }).optionId;
      priceByKey.set(`${row.pricingTierId}:${itemId}`, row);
    }

    const result = new Map<string, ResolvedItemPrice>();
    for (const item of items) {
      const visited = new Set<string>();
      const resolve = (currentTierId: string): ResolvedItemPrice => {
        if (visited.has(currentTierId)) {
          throw new BadRequestException('Pricing derivation cycle detected');
        }
        visited.add(currentTierId);
        const row = priceByKey.get(`${currentTierId}:${item.id}`);
        if (row?.source === 'OVERRIDE') return { price: row.price, source: 'OVERRIDE' };
        if (row && (row.source === 'MANUAL' || row.source === 'DERIVED')) {
          return { price: row.price, source: row.source as 'MANUAL' | 'DERIVED' };
        }
        const currentTier = tierById.get(currentTierId);
        if (!currentTier) return { price: null, source: 'MISSING' };
        if (currentTier.derivationType === 'COST_FACTOR') {
          const factor = this.toPositiveDecimal(currentTier.derivationFactor, 'Cost multiplier is required');
          return {
            price: this.roundUpToNickel(this.toDecimal(item.costPrice).mul(factor)),
            source: 'DERIVED',
          };
        }
        if (currentTier.derivationType === 'TIER_PERCENTAGE' && currentTier.derivationSourceTierId) {
          const base = resolve(currentTier.derivationSourceTierId);
          if (!base.price) return { price: null, source: 'MISSING' };
          const percentage = this.toNonNegativeDecimal(
            currentTier.derivationFactor,
            'Percentage derivation rate is required',
          );
          return {
            price: this.roundUpToNickel(
              base.price.mul(new Prisma.Decimal('1').add(percentage)),
            ),
            source: 'DERIVED',
          };
        }
        return { price: null, source: 'MISSING' };
      };
      result.set(item.id, resolve(tierId));
    }
    return result;
  }

  async updateDishPrice(tierId: string, dishId: string, dto: SetPricingItemPriceDto) {
    await this.ensureTierExists(tierId);
    await this.ensureDishExists(dishId);

    const source = dto.override ? 'OVERRIDE' : 'MANUAL';
    const price = this.toMoney(dto.price);

    return this.prisma.dishPrice.upsert({
      where: {
        dishId_pricingTierId: {
          dishId,
          pricingTierId: tierId,
        },
      },
      update: {
        price,
        source,
      },
      create: {
        dishId,
        pricingTierId: tierId,
        price,
        source,
      },
    });
  }

  async updateOptionPrice(
    tierId: string,
    optionId: string,
    dto: SetPricingItemPriceDto,
  ) {
    await this.ensureTierExists(tierId);
    await this.ensureOptionExists(optionId);

    const source = dto.override ? 'OVERRIDE' : 'MANUAL';
    const price = this.toMoney(dto.price);

    return this.prisma.optionPrice.upsert({
      where: {
        optionId_pricingTierId: {
          optionId,
          pricingTierId: tierId,
        },
      },
      update: {
        price,
        source,
      },
      create: {
        optionId,
        pricingTierId: tierId,
        price,
        source,
      },
    });
  }

  async clearDishPrice(tierId: string, dishId: string) {
    await this.ensureTierExists(tierId);
    await this.ensureDishExists(dishId);
    await this.prisma.dishPrice.deleteMany({
      where: { dishId, pricingTierId: tierId },
    });
    return this.resolveDishPrice(tierId, dishId);
  }

  async clearOptionPrice(tierId: string, optionId: string) {
    await this.ensureTierExists(tierId);
    await this.ensureOptionExists(optionId);
    await this.prisma.optionPrice.deleteMany({
      where: { optionId, pricingTierId: tierId },
    });
    return this.resolveOptionPrice(tierId, optionId);
  }

  private async calculateDishDerivation(
    tier: { id: string; derivationType: string; derivationFactor: Prisma.Decimal | string | null; derivationSourceTierId: string | null },
    dish: { id: string; costPrice: Prisma.Decimal | string },
  ): Promise<Prisma.Decimal | null> {
    if (tier.derivationType === 'COST_FACTOR') {
      const factor = this.toPositiveDecimal(tier.derivationFactor, 'Cost multiplier is required');
      const raw = this.toDecimal(dish.costPrice).mul(factor);
      return this.roundUpToNickel(raw);
    }

    if (tier.derivationType === 'TIER_PERCENTAGE') {
      if (!tier.derivationSourceTierId) {
        return null;
      }
      const base = await this.resolvePriceFromSourceTier(
        tier.derivationSourceTierId,
        'dish',
        dish.id,
        new Set([tier.id]),
      );
      if (!base) {
        return null;
      }
      const factor = this.toNonNegativeDecimal(tier.derivationFactor, 'Percentage derivation rate is required');
      const adjusted = base.mul(new Prisma.Decimal('1').add(factor));
      return this.roundUpToNickel(adjusted);
    }

    return null;
  }

  private async calculateOptionDerivation(
    tier: { id: string; derivationType: string; derivationFactor: Prisma.Decimal | string | null; derivationSourceTierId: string | null },
    option: { id: string; costPrice: Prisma.Decimal | string },
  ): Promise<Prisma.Decimal | null> {
    if (tier.derivationType === 'COST_FACTOR') {
      const factor = this.toPositiveDecimal(tier.derivationFactor, 'Cost multiplier is required');
      const raw = this.toDecimal(option.costPrice).mul(factor);
      return this.roundUpToNickel(raw);
    }

    if (tier.derivationType === 'TIER_PERCENTAGE') {
      if (!tier.derivationSourceTierId) {
        return null;
      }
      const base = await this.resolvePriceFromSourceTier(
        tier.derivationSourceTierId,
        'option',
        option.id,
        new Set([tier.id]),
      );
      if (!base) {
        return null;
      }
      const factor = this.toNonNegativeDecimal(tier.derivationFactor, 'Percentage derivation rate is required');
      const adjusted = base.mul(new Prisma.Decimal('1').add(factor));
      return this.roundUpToNickel(adjusted);
    }

    return null;
  }

  private async resolvePriceFromSourceTier(
    tierId: string,
    itemType: 'dish' | 'option',
    itemId: string,
    visited: Set<string>,
  ): Promise<Prisma.Decimal | null> {
    if (visited.has(tierId)) {
      throw new BadRequestException('Pricing derivation cycle detected');
    }

    const tier = await this.prisma.pricingTier.findUnique({
      where: { id: tierId },
    });
    if (!tier) {
      return null;
    }

    visited.add(tierId);

    const row = itemType === 'dish'
      ? await this.prisma.dishPrice.findUnique({
          where: {
            dishId_pricingTierId: {
              dishId: itemId,
              pricingTierId: tierId,
            },
          },
        })
      : await this.prisma.optionPrice.findUnique({
          where: {
            optionId_pricingTierId: {
              optionId: itemId,
              pricingTierId: tierId,
            },
          },
        });
    if (row) {
      return row.price;
    }

    if (tier.derivationType === 'COST_FACTOR') {
      const factor = this.toPositiveDecimal(tier.derivationFactor, 'Cost multiplier is required');
      const item = itemType === 'dish'
        ? await this.prisma.dish.findUnique({ where: { id: itemId } })
        : await this.prisma.option.findUnique({ where: { id: itemId } });
      if (!item) {
        return null;
      }
      return this.roundUpToNickel(this.toDecimal(item.costPrice).mul(factor));
    }

    if (tier.derivationType === 'TIER_PERCENTAGE' && tier.derivationSourceTierId) {
      const base = await this.resolvePriceFromSourceTier(
        tier.derivationSourceTierId,
        itemType,
        itemId,
        new Set(visited),
      );
      if (!base) {
        return null;
      }
      const factor = this.toNonNegativeDecimal(tier.derivationFactor, 'Percentage derivation rate is required');
      return this.roundUpToNickel(base.mul(new Prisma.Decimal('1').add(factor)));
    }

    return null;
  }

  private async ensureTierExists(id: string) {
    const tier = await this.prisma.pricingTier.findUnique({ where: { id } });
    if (!tier) {
      throw new NotFoundException('Pricing tier not found');
    }
  }

  private async ensureDishExists(id: string) {
    const dish = await this.prisma.dish.findUnique({ where: { id } });
    if (!dish) {
      throw new NotFoundException('Dish not found');
    }
  }

  private async ensureOptionExists(id: string) {
    const option = await this.prisma.option.findUnique({ where: { id } });
    if (!option) {
      throw new NotFoundException('Option not found');
    }
  }

  private normalizeTierName(name: string) {
    const normalized = name.trim();
    if (!normalized) {
      throw new BadRequestException('Pricing tier name is required');
    }
    return normalized;
  }

  private async validateTierConfiguration(
    tierId: string | null,
    derivationType: 'NONE' | 'COST_FACTOR' | 'TIER_PERCENTAGE',
    derivationSourceTierId: string | null,
    derivationFactor: Prisma.Decimal | number | string | null,
  ) {
    const normalizedType = derivationType ?? 'NONE';

    if (normalizedType === 'COST_FACTOR') {
      const value = this.toPositiveDecimal(
        derivationFactor,
        'Cost multiplier is required and must be positive',
      );
      return {
        derivationType: 'COST_FACTOR' as const,
        derivationSourceTierId: null,
        derivationFactor: value,
      };
    }

    if (normalizedType === 'TIER_PERCENTAGE') {
      if (!derivationSourceTierId) {
        throw new BadRequestException('A source tier is required for percentage-based derivation');
      }
      if (tierId && derivationSourceTierId === tierId) {
        throw new BadRequestException('A pricing tier cannot derive from itself');
      }
      const sourceTier = await this.prisma.pricingTier.findUnique({
        where: { id: derivationSourceTierId },
      });
      if (!sourceTier) {
        throw new BadRequestException('Source pricing tier not found');
      }
      const wouldCycle = await this.wouldCreateCycle(tierId, derivationSourceTierId);
      if (wouldCycle) {
        throw new BadRequestException('Pricing derivation cycle detected');
      }
      const value = this.toNonNegativeDecimal(
        derivationFactor,
        'Percentage derivation rate is required and must be zero or greater',
      );
      const ratio = value.div(100);
      if (ratio.decimalPlaces() > 4) {
        throw new BadRequestException('Percentage derivation supports up to two decimal places');
      }
      return {
        derivationType: 'TIER_PERCENTAGE' as const,
        derivationSourceTierId,
        derivationFactor: ratio,
      };
    }

    return {
      derivationType: 'NONE' as const,
      derivationSourceTierId: null,
      derivationFactor: null,
    };
  }

  private async wouldCreateCycle(
    tierId: string | null,
    sourceTierId: string,
  ): Promise<boolean> {
    if (!tierId) {
      return false;
    }

    if (sourceTierId === tierId) {
      return true;
    }

    const allTiers = await this.prisma.pricingTier.findMany({
      select: { id: true, derivationSourceTierId: true },
    });
    const chain = new Map<string, string | null>();
    for (const tier of allTiers) {
      chain.set(tier.id, tier.derivationSourceTierId ?? null);
    }

    const visited = new Set<string>();
    let current: string | null = sourceTierId;
    while (current) {
      if (current === tierId) {
        return true;
      }
      if (visited.has(current)) {
        break;
      }
      visited.add(current);
      current = chain.get(current) ?? null;
    }

    return false;
  }

  private roundUpToNickel(amount: Prisma.Decimal): Prisma.Decimal {
    const nickel = new Prisma.Decimal('0.05');
    return amount.div(nickel).ceil().mul(nickel);
  }

  private toPositiveDecimal(value: number | string | Prisma.Decimal | null, message: string) {
    if (value === null || value === undefined) {
      throw new BadRequestException(message);
    }
    const decimalValue = this.toDecimal(value);
    if (decimalValue.lte(0)) {
      throw new BadRequestException(message);
    }
    return decimalValue;
  }

  private toDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
    const numeric = value.toString();
    const decimal = new Prisma.Decimal(numeric);
    if (!decimal.isFinite()) {
      throw new BadRequestException('Monetary value must be numeric');
    }
    return decimal;
  }

  private toMoney(value: number | string): Prisma.Decimal {
    const amount = this.toDecimal(value);
    if (amount.isNegative()) {
      throw new BadRequestException('Monetary value must be zero or greater');
    }
    return amount;
  }

  private toNonNegativeDecimal(
    value: Prisma.Decimal | number | string | null,
    message: string,
  ) {
    if (value === null || value === undefined) {
      throw new BadRequestException(message);
    }
    const decimalValue = this.toDecimal(value);
    if (decimalValue.isNegative()) {
      throw new BadRequestException(message);
    }
    return decimalValue;
  }

  private formatMoney(value: Prisma.Decimal | null): string | null {
    if (!value) {
      return null;
    }
    return value.toFixed(2);
  }
}

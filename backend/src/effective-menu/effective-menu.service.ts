import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PricingService } from '../pricing/pricing.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class EffectiveMenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  async getForEmployee(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        company: {
          include: {
            priceTier: true,
          },
        },
        allergies: { include: { allergen: { select: { id: true, name: true } } } },
        dietaryPreferences: {
          include: { dietaryTag: { select: { id: true, name: true } } },
        },
      },
    });
    if (!employee || !employee.active) {
      throw new NotFoundException('Active employee not found');
    }
    if (!employee.company.active) {
      throw new BadRequestException('Employee belongs to an inactive company');
    }

    const tier = employee.company.priceTier
      ?? await this.prisma.pricingTier.findFirst({ where: { isDefault: true } });
    if (!tier) throw new BadRequestException('No default pricing tier is configured');

    const categories = await this.prisma.category.findMany({
      where: {
        active: true,
        secret: false,
        companyVisibility: {
          none: { companyId: employee.companyId, visible: false },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: {
        dishes: {
          where: {
            dish: {
              active: true,
              companyVisibility: {
                none: { companyId: employee.companyId, visible: false },
              },
            },
          },
          orderBy: [{ displayOrder: 'asc' }, { dish: { name: 'asc' } }],
          include: {
            dish: {
              select: {
                id: true,
                name: true,
                description: true,
                imageUrl: true,
                sku: true,
                temperature: true,
                costPrice: true,
                minimumOrderQuantity: true,
                station: { select: { id: true, name: true, active: true } },
                allergens: {
                  select: { allergen: { select: { id: true, name: true } } },
                },
                dietaryTags: {
                  select: { dietaryTag: { select: { id: true, name: true } } },
                },
                optionGroups: {
                  where: { active: true },
                  orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
                  include: {
                    sizes: {
                      where: { portionSize: { active: true } },
                      orderBy: [{ portionSize: { displayOrder: 'asc' } }],
                      include: {
                        portionSize: { select: { id: true, name: true, displayOrder: true } },
                      },
                    },
                    options: {
                      where: { option: { active: true } },
                      orderBy: [{ displayOrder: 'asc' }, { option: { name: 'asc' } }],
                      include: {
                        option: {
                          select: {
                            id: true,
                            name: true,
                            description: true,
                            costPrice: true,
                            allergens: {
                              select: { allergen: { select: { id: true, name: true } } },
                            },
                            dietaryTags: {
                              select: { dietaryTag: { select: { id: true, name: true } } },
                            },
                          },
                        },
                        sizePrices: {
                          where: { portionSize: { active: true } },
                          orderBy: { portionSize: { displayOrder: 'asc' } },
                          include: {
                            portionSize: { select: { id: true, name: true, displayOrder: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const allDishes = categories.flatMap((category) =>
      category.dishes.map((relation) => relation.dish),
    );
    const dishesById = new Map(allDishes.map((dish) => [dish.id, dish]));
    const uniqueDishes = [...dishesById.values()];
    const optionsById = new Map(
      uniqueDishes.flatMap((dish) =>
        dish.optionGroups.flatMap((group) =>
          group.options.map((relation) => [relation.option.id, relation.option] as const),
        ),
      ),
    );
    const [dishPrices, optionPrices] = await Promise.all([
      this.pricing.resolveDishPrices(
        tier.id,
        uniqueDishes.map(({ id, costPrice }) => ({ id, costPrice })),
      ),
      this.pricing.resolveOptionPrices(
        tier.id,
        [...optionsById.values()].map(({ id, costPrice }) => ({ id, costPrice })),
      ),
    ]);

    const dishView = (dish: (typeof uniqueDishes)[number]) => {
      const resolvedPrice = dishPrices.get(dish.id);
      if (!resolvedPrice?.price) return null;
      return {
        id: dish.id,
        name: dish.name,
        description: dish.description,
        imageUrl: dish.imageUrl,
        sku: dish.sku,
        temperature: dish.temperature,
        minimumOrderQuantity: dish.minimumOrderQuantity,
        price: resolvedPrice.price.toFixed(2),
        priceSource: resolvedPrice.source,
        station: dish.station.name,
        allergens: dish.allergens.map(({ allergen }) => allergen),
        dietaryTags: dish.dietaryTags.map(({ dietaryTag }) => dietaryTag),
        optionGroups: dish.optionGroups.map((group) => ({
          id: group.id,
          name: group.name,
          required: group.required,
          displayOrder: group.displayOrder,
          portionSizes: group.sizes.map(({ portionSize }) => ({
            id: portionSize.id,
            name: portionSize.name,
            displayOrder: portionSize.displayOrder,
          })),
          options: group.options.flatMap((relation) => {
            const resolved = optionPrices.get(relation.option.id);
            if (!resolved?.price) return [];
            return [{
              id: relation.option.id,
              name: relation.option.name,
              description: relation.option.description,
              displayOrder: relation.displayOrder,
              price: resolved.price.toFixed(2),
              priceSource: resolved.source,
              allergens: relation.option.allergens.map(({ allergen }) => allergen),
              dietaryTags: relation.option.dietaryTags.map(({ dietaryTag }) => dietaryTag),
              sizePrices: relation.sizePrices.map((sizePrice) => ({
                portionSize: {
                  id: sizePrice.portionSize.id,
                  name: sizePrice.portionSize.name,
                  displayOrder: sizePrice.portionSize.displayOrder,
                },
                extraCharge: sizePrice.extraCharge.toFixed(2),
                priceWithExtraCharge: resolved.price
                  ?.add(sizePrice.extraCharge)
                  .toFixed(2),
              })),
            }];
          }),
        })),
      };
    };

    return {
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        allergies: employee.allergies.map(({ allergen }) => allergen),
        dietaryPreferences: employee.dietaryPreferences.map(({ dietaryTag }) => dietaryTag),
      },
      company: {
        id: employee.company.id,
        name: employee.company.name,
        priceTier: { id: tier.id, name: tier.name },
      },
      categories: categories.flatMap((category) => {
        const dishes = category.dishes
          .map(({ dish }) => dishView(dish))
          .filter((dish) => dish !== null);
        return dishes.length
          ? [{ id: category.id, name: category.name, displayOrder: category.displayOrder, dishes }]
          : [];
      }),
    };
  }
}

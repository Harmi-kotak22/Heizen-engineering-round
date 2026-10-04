import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AddGroupSizeDto,
  AddOptionToGroupDto,
  CreateCategoryDto,
  CreateDishDto,
  CreateOptionDto,
  CreateOptionGroupDto,
  SetOptionExtraChargeDto,
  UpdateCategoryDto,
  UpdateDishDto,
  UpdateOptionDto,
  UpdateOptionGroupDto,
} from './dto/catalogue.dto.js';

@Injectable()
export class CatalogueService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(active?: boolean, search?: string, page = 1, limit = 20) {
    const where: Prisma.CategoryWhereInput = {};

    if (active !== undefined) {
      where.active = active;
    }
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          dishes: {
            include: {
              dish: true,
            },
          },
        },
      }),
      this.prisma.category.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCategory(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        dishes: {
          include: {
            dish: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async createCategory(dto: CreateCategoryDto) {
    const name = dto.name.trim();
    const existing = await this.prisma.category.findUnique({ where: { name } });
    if (existing) {
      throw new BadRequestException('Category already exists');
    }

    return this.prisma.category.create({
      data: {
        name,
        displayOrder: dto.displayOrder ?? 0,
        active: true,
        secret: dto.secret ?? false,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    await this.ensureCategoryExists(id);

    const data: Prisma.CategoryUpdateInput = {};
    if (dto.name) {
      data.name = dto.name.trim();
    }
    if (dto.displayOrder !== undefined) {
      data.displayOrder = dto.displayOrder;
    }
    if (dto.active !== undefined) {
      data.active = dto.active;
    }
    if (dto.secret !== undefined) {
      data.secret = dto.secret;
    }

    return this.prisma.category.update({
      where: { id },
      data,
    });
  }

  async setCategoryStatus(id: string, active: boolean) {
    await this.ensureCategoryExists(id);
    return this.prisma.category.update({
      where: { id },
      data: { active },
    });
  }

  async addDishToCategory(categoryId: string, dishId: string, displayOrder = 0) {
    await this.ensureCategoryExists(categoryId);
    await this.ensureDishExists(dishId);

    const existing = await this.prisma.categoryDish.findUnique({
      where: {
        categoryId_dishId: {
          categoryId,
          dishId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Dish already assigned to category');
    }

    return this.prisma.categoryDish.create({
      data: {
        categoryId,
        dishId,
        displayOrder,
      },
    });
  }

  async removeDishFromCategory(categoryId: string, dishId: string) {
    await this.ensureCategoryExists(categoryId);
    await this.ensureDishExists(dishId);

    return this.prisma.categoryDish.delete({
      where: {
        categoryId_dishId: {
          categoryId,
          dishId,
        },
      },
    });
  }

  async listDishes(query: {
    active?: boolean;
    stationId?: string;
    categoryId?: string;
    temperature?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const where: Prisma.DishWhereInput = {};

    if (query.active !== undefined) {
      where.active = query.active;
    }
    if (query.stationId) {
      where.stationId = query.stationId;
    }
    if (query.temperature) {
      where.temperature = query.temperature as Prisma.EnumTemperatureFilter;
    }
    if (query.categoryId) {
      where.categories = {
        some: {
          categoryId: query.categoryId,
        },
      };
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, total] = await Promise.all([
      this.prisma.dish.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          station: true,
          allergens: { include: { allergen: true } },
          dietaryTags: { include: { dietaryTag: true } },
          categories: { include: { category: true } },
          optionGroups: { include: { sizes: { include: { portionSize: true } }, options: { include: { option: true } } } },
        },
      }),
      this.prisma.dish.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDish(id: string) {
    const dish = await this.prisma.dish.findUnique({
      where: { id },
      include: {
        station: true,
        allergens: { include: { allergen: true } },
        dietaryTags: { include: { dietaryTag: true } },
        categories: { include: { category: true } },
        optionGroups: {
          include: {
            sizes: { include: { portionSize: true } },
            options: {
              include: {
                option: true,
                sizePrices: {
                  include: { portionSize: true },
                },
              },
            },
          },
        },
      },
    });

    if (!dish) {
      throw new NotFoundException('Dish not found');
    }

    return dish;
  }

  async createDish(dto: CreateDishDto) {
    await this.ensureStationExists(dto.stationId);
    await this.validateUniqueSku(dto.sku);
    await this.validateDishRelations(dto.allergenIds ?? [], dto.dietaryTagIds ?? [], dto.categoryIds ?? []);

    return this.prisma.dish.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        imageUrl: dto.imageUrl?.trim() || null,
        sku: dto.sku.trim(),
        temperature: dto.temperature,
        costPrice: this.toMoney(dto.costPrice),
        stationId: dto.stationId,
        minimumOrderQuantity: dto.minimumOrderQuantity ?? 1,
        active: true,
        allergens: dto.allergenIds?.length
          ? {
              create: dto.allergenIds.map((allergenId) => ({ allergenId })),
            }
          : undefined,
        dietaryTags: dto.dietaryTagIds?.length
          ? {
              create: dto.dietaryTagIds.map((dietaryTagId) => ({ dietaryTagId })),
            }
          : undefined,
        categories: dto.categoryIds?.length
          ? {
              create: dto.categoryIds.map((categoryId, index) => ({
                categoryId,
                displayOrder: index,
              })),
            }
          : undefined,
      },
      include: {
        station: true,
        allergens: { include: { allergen: true } },
        dietaryTags: { include: { dietaryTag: true } },
        categories: { include: { category: true } },
      },
    });
  }

  async updateDish(id: string, dto: UpdateDishDto) {
    return this.prisma.$transaction(async (tx) => {
      const existingDish = await tx.dish.findUnique({ where: { id } });
      if (!existingDish) {
        throw new NotFoundException('Dish not found');
      }
      if (dto.stationId) {
        const station = await tx.station.findUnique({ where: { id: dto.stationId } });
        if (!station) throw new NotFoundException('Station not found');
      }
      if (dto.sku && dto.sku.trim() !== existingDish.sku) {
        const dishWithSku = await tx.dish.findUnique({ where: { sku: dto.sku.trim() } });
        if (dishWithSku && dishWithSku.id !== id) {
          throw new BadRequestException('Dish SKU already exists');
        }
      }
      if (dto.allergenIds || dto.dietaryTagIds || dto.categoryIds) {
        await this.validateDishRelations(
          dto.allergenIds ?? [],
          dto.dietaryTagIds ?? [],
          dto.categoryIds ?? [],
          tx,
        );
      }

      const data: Prisma.DishUpdateInput = {};
      if (dto.name) data.name = dto.name.trim();
      if (dto.description !== undefined) data.description = dto.description?.trim() || null;
      if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl?.trim() || null;
      if (dto.sku) data.sku = dto.sku.trim();
      if (dto.temperature) data.temperature = dto.temperature;
      if (dto.costPrice !== undefined) data.costPrice = this.toMoney(dto.costPrice);
      if (dto.stationId) data.station = { connect: { id: dto.stationId } };
      if (dto.minimumOrderQuantity !== undefined) {
        data.minimumOrderQuantity = dto.minimumOrderQuantity;
      }

      await tx.dish.update({ where: { id }, data });

      if (dto.allergenIds) {
        await tx.dishAllergen.deleteMany({ where: { dishId: id } });
        if (dto.allergenIds.length) {
          await tx.dishAllergen.createMany({
            data: dto.allergenIds.map((allergenId) => ({ dishId: id, allergenId })),
          });
        }
      }

      if (dto.dietaryTagIds) {
        await tx.dishDietaryTag.deleteMany({ where: { dishId: id } });
        if (dto.dietaryTagIds.length) {
          await tx.dishDietaryTag.createMany({
            data: dto.dietaryTagIds.map((dietaryTagId) => ({ dishId: id, dietaryTagId })),
          });
        }
      }

      if (dto.categoryIds) {
        await tx.categoryDish.deleteMany({ where: { dishId: id } });
        if (dto.categoryIds.length) {
          await tx.categoryDish.createMany({
            data: dto.categoryIds.map((categoryId, index) => ({
              categoryId,
              dishId: id,
              displayOrder: index,
            })),
          });
        }
      }

      return tx.dish.findUnique({
        where: { id },
        include: {
          station: true,
          allergens: { include: { allergen: true } },
          dietaryTags: { include: { dietaryTag: true } },
          categories: { include: { category: true } },
        },
      });
    });
  }

  async setDishStatus(id: string, active: boolean) {
    await this.ensureDishExists(id);
    return this.prisma.dish.update({
      where: { id },
      data: { active },
    });
  }

  async listOptions(active?: boolean, search?: string, page = 1, limit = 20) {
    const where: Prisma.OptionWhereInput = {};

    if (active !== undefined) {
      where.active = active;
    }
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.option.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          allergens: { include: { allergen: true } },
          dietaryTags: { include: { dietaryTag: true } },
        },
      }),
      this.prisma.option.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOption(id: string) {
    const option = await this.prisma.option.findUnique({
      where: { id },
      include: {
        allergens: { include: { allergen: true } },
        dietaryTags: { include: { dietaryTag: true } },
        groups: {
          include: {
            optionGroup: true,
          },
        },
      },
    });

    if (!option) {
      throw new NotFoundException('Option not found');
    }

    return option;
  }

  async createOption(dto: CreateOptionDto) {
    await this.validateOptionRelations(dto.allergenIds ?? [], dto.dietaryTagIds ?? []);

    return this.prisma.option.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        costPrice: this.toMoney(dto.costPrice),
        active: true,
        allergens: dto.allergenIds?.length
          ? {
              create: dto.allergenIds.map((allergenId) => ({ allergenId })),
            }
          : undefined,
        dietaryTags: dto.dietaryTagIds?.length
          ? {
              create: dto.dietaryTagIds.map((dietaryTagId) => ({ dietaryTagId })),
            }
          : undefined,
      },
      include: {
        allergens: { include: { allergen: true } },
        dietaryTags: { include: { dietaryTag: true } },
      },
    });
  }

  async updateOption(id: string, dto: UpdateOptionDto) {
    await this.ensureOptionExists(id);
    if (dto.allergenIds || dto.dietaryTagIds) {
      await this.validateOptionRelations(dto.allergenIds ?? [], dto.dietaryTagIds ?? []);
    }

    const data: Prisma.OptionUpdateInput = {};
    if (dto.name) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.costPrice !== undefined) data.costPrice = this.toMoney(dto.costPrice);
    if (dto.active !== undefined) data.active = dto.active;

    const updated = await this.prisma.option.update({
      where: { id },
      data,
      include: {
        allergens: { include: { allergen: true } },
        dietaryTags: { include: { dietaryTag: true } },
      },
    });

    if (dto.allergenIds) {
      await this.prisma.optionAllergen.deleteMany({ where: { optionId: id } });
      if (dto.allergenIds.length) {
        await this.prisma.optionAllergen.createMany({
          data: dto.allergenIds.map((allergenId) => ({ optionId: id, allergenId })),
        });
      }
    }

    if (dto.dietaryTagIds) {
      await this.prisma.optionDietaryTag.deleteMany({ where: { optionId: id } });
      if (dto.dietaryTagIds.length) {
        await this.prisma.optionDietaryTag.createMany({
          data: dto.dietaryTagIds.map((dietaryTagId) => ({ optionId: id, dietaryTagId })),
        });
      }
    }

    return updated;
  }

  async setOptionStatus(id: string, active: boolean) {
    await this.ensureOptionExists(id);
    return this.prisma.option.update({
      where: { id },
      data: { active },
    });
  }

  async createOptionGroup(dishId: string, dto: CreateOptionGroupDto) {
    return this.prisma.$transaction(async (tx) => {
      const dish = await tx.dish.findUnique({ where: { id: dishId } });
      if (!dish) throw new NotFoundException('Dish not found');

      const optionIds = [...new Set(dto.optionIds ?? [])];
      const portionSizeIds = [...new Set(dto.portionSizeIds ?? [])];
      if (optionIds.length) {
        const options = await tx.option.findMany({ where: { id: { in: optionIds } } });
        if (options.length !== optionIds.length) {
          throw new NotFoundException('Option not found');
        }
      }
      if (portionSizeIds.length) {
        const sizes = await tx.portionSize.findMany({
          where: { id: { in: portionSizeIds } },
        });
        if (sizes.length !== portionSizeIds.length) {
          throw new NotFoundException('Portion size not found');
        }
      }

      const group = await tx.optionGroup.create({
        data: {
          dishId,
          name: dto.name.trim(),
          required: dto.required ?? false,
          displayOrder: dto.displayOrder ?? 0,
        },
      });

      if (optionIds.length) {
        await tx.optionGroupOption.createMany({
          data: optionIds.map((optionId) => ({
            optionGroupId: group.id,
            optionId,
            displayOrder: 0,
          })),
        });
      }
      if (portionSizeIds.length) {
        await tx.optionGroupSize.createMany({
          data: portionSizeIds.map((portionSizeId) => ({
            optionGroupId: group.id,
            portionSizeId,
          })),
        });
      }

      return tx.optionGroup.findUnique({
        where: { id: group.id },
        include: {
          sizes: { include: { portionSize: true } },
          options: {
            include: {
              option: true,
              sizePrices: { include: { portionSize: true } },
            },
          },
        },
      });
    });
  }

  async getOptionGroup(id: string) {
    const group = await this.prisma.optionGroup.findUnique({
      where: { id },
      include: {
        sizes: { include: { portionSize: true } },
        options: {
          include: {
            option: true,
            sizePrices: { include: { portionSize: true } },
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Option group not found');
    }

    return group;
  }

  async updateOptionGroup(id: string, dto: UpdateOptionGroupDto) {
    await this.ensureOptionGroupExists(id);

    const data: Prisma.OptionGroupUpdateInput = {};
    if (dto.name) data.name = dto.name.trim();
    if (dto.required !== undefined) data.required = dto.required;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.active !== undefined) data.active = dto.active;

    return this.prisma.optionGroup.update({
      where: { id },
      data,
    });
  }

  async deleteOptionGroup(id: string) {
    await this.ensureOptionGroupExists(id);
    return this.prisma.optionGroup.delete({ where: { id } });
  }

  async addOptionToGroup(groupId: string, dto: AddOptionToGroupDto) {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.optionGroup.findUnique({ where: { id: groupId } });
      if (!group) throw new NotFoundException('Option group not found');
      const option = await tx.option.findUnique({ where: { id: dto.optionId } });
      if (!option) throw new NotFoundException('Option not found');

      const exists = await tx.optionGroupOption.findUnique({
        where: {
          optionGroupId_optionId: {
            optionGroupId: groupId,
            optionId: dto.optionId,
          },
        },
      });
      if (exists) throw new BadRequestException('Option already exists in group');

      await tx.optionGroupOption.create({
        data: {
          optionGroupId: groupId,
          optionId: dto.optionId,
          displayOrder: dto.displayOrder ?? 0,
        },
      });

      await this.validateGroupSizeConsistency(groupId, tx);
      return tx.optionGroup.findUnique({
        where: { id: groupId },
        include: {
          sizes: { include: { portionSize: true } },
          options: {
            include: {
              option: true,
              sizePrices: { include: { portionSize: true } },
            },
          },
        },
      });
    });
  }

  async removeOptionFromGroup(groupId: string, optionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.optionGroup.findUnique({ where: { id: groupId } });
      if (!group) throw new NotFoundException('Option group not found');
      const option = await tx.option.findUnique({ where: { id: optionId } });
      if (!option) throw new NotFoundException('Option not found');

      await tx.optionGroupOptionSize.deleteMany({
        where: { optionGroupId: groupId, optionId },
      });
      await tx.optionGroupOption.delete({
        where: {
          optionGroupId_optionId: {
            optionGroupId: groupId,
            optionId,
          },
        },
      });

      return tx.optionGroup.findUnique({
        where: { id: groupId },
        include: {
          sizes: { include: { portionSize: true } },
          options: {
            include: {
              option: true,
              sizePrices: { include: { portionSize: true } },
            },
          },
        },
      });
    });
  }

  async addPortionSizeToGroup(groupId: string, dto: AddGroupSizeDto) {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.optionGroup.findUnique({ where: { id: groupId } });
      if (!group) throw new NotFoundException('Option group not found');
      const size = await tx.portionSize.findUnique({
        where: { id: dto.portionSizeId },
      });
      if (!size) throw new NotFoundException('Portion size not found');

      const existing = await tx.optionGroupSize.findUnique({
        where: {
          optionGroupId_portionSizeId: {
            optionGroupId: groupId,
            portionSizeId: dto.portionSizeId,
          },
        },
      });
      if (existing) {
        throw new BadRequestException('Portion size already enabled for this group');
      }

      await tx.optionGroupSize.create({
        data: {
          optionGroupId: groupId,
          portionSizeId: dto.portionSizeId,
        },
      });

      await this.validateGroupSizeConsistency(groupId, tx);
      return tx.optionGroup.findUnique({
        where: { id: groupId },
        include: {
          sizes: { include: { portionSize: true } },
          options: {
            include: {
              option: true,
              sizePrices: { include: { portionSize: true } },
            },
          },
        },
      });
    });
  }

  async removePortionSizeFromGroup(groupId: string, portionSizeId: string) {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.optionGroup.findUnique({ where: { id: groupId } });
      if (!group) throw new NotFoundException('Option group not found');
      const size = await tx.portionSize.findUnique({ where: { id: portionSizeId } });
      if (!size) throw new NotFoundException('Portion size not found');

      await tx.optionGroupOptionSize.deleteMany({
        where: { optionGroupId: groupId, portionSizeId },
      });
      await tx.optionGroupSize.delete({
        where: {
          optionGroupId_portionSizeId: {
            optionGroupId: groupId,
            portionSizeId,
          },
        },
      });

      return tx.optionGroup.findUnique({
        where: { id: groupId },
        include: {
          sizes: { include: { portionSize: true } },
          options: {
            include: {
              option: true,
              sizePrices: { include: { portionSize: true } },
            },
          },
        },
      });
    });
  }

  async setOptionExtraCharge(
    groupId: string,
    optionId: string,
    dto: SetOptionExtraChargeDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.optionGroup.findUnique({ where: { id: groupId } });
      if (!group) throw new NotFoundException('Option group not found');
      const option = await tx.option.findUnique({ where: { id: optionId } });
      if (!option) throw new NotFoundException('Option not found');
      const size = await tx.portionSize.findUnique({
        where: { id: dto.portionSizeId },
      });
      if (!size) throw new NotFoundException('Portion size not found');

      const supportsSize = await tx.optionGroupSize.findUnique({
        where: {
          optionGroupId_portionSizeId: {
            optionGroupId: groupId,
            portionSizeId: dto.portionSizeId,
          },
        },
      });
      if (!supportsSize) {
        throw new BadRequestException('Portion size is not enabled for this option group');
      }

      const groupOption = await tx.optionGroupOption.findUnique({
        where: {
          optionGroupId_optionId: {
            optionGroupId: groupId,
            optionId,
          },
        },
      });
      if (!groupOption) {
        throw new BadRequestException('Option is not assigned to this group');
      }

      const entry = await tx.optionGroupOptionSize.upsert({
        where: {
          optionGroupId_optionId_portionSizeId: {
            optionGroupId: groupId,
            optionId,
            portionSizeId: dto.portionSizeId,
          },
        },
        update: { extraCharge: this.toMoney(dto.extraCharge) },
        create: {
          optionGroupId: groupId,
          optionId,
          portionSizeId: dto.portionSizeId,
          extraCharge: this.toMoney(dto.extraCharge),
        },
      });

      await this.validateGroupSizeConsistency(groupId, tx);
      return entry;
    });
  }

  private async validateGroupSizeConsistency(
    groupId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const group = await tx.optionGroup.findUnique({
      where: { id: groupId },
      include: {
        sizes: true,
        options: {
          include: {
            sizePrices: true,
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Option group not found');
    }

    if (!group.sizes.length) {
      return;
    }

    const supportedSizeIds = group.sizes.map((size) => size.portionSizeId);

    for (const groupOption of group.options) {
      const sizePriceIds = groupOption.sizePrices.map((price) => price.portionSizeId);
      const missing = supportedSizeIds.filter((id) => !sizePriceIds.includes(id));

      if (missing.length) {
        throw new BadRequestException(
          `Option group must provide pricing for each supported size. Missing sizes for option: ${groupOption.optionId}`,
        );
      }
    }
  }

  private async ensureCategoryExists(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }

  private async ensureDishExists(id: string) {
    const dish = await this.prisma.dish.findUnique({ where: { id } });
    if (!dish) {
      throw new NotFoundException('Dish not found');
    }

    return dish;
  }

  private async ensureStationExists(id: string) {
    const station = await this.prisma.station.findUnique({ where: { id } });
    if (!station) {
      throw new NotFoundException('Station not found');
    }
  }

  private async ensureOptionExists(id: string) {
    const option = await this.prisma.option.findUnique({ where: { id } });
    if (!option) {
      throw new NotFoundException('Option not found');
    }
  }

  private async ensureOptionGroupExists(id: string) {
    const optionGroup = await this.prisma.optionGroup.findUnique({ where: { id } });
    if (!optionGroup) {
      throw new NotFoundException('Option group not found');
    }
  }

  private async validateUniqueSku(sku: string, ignoreDishId?: string) {
    const dish = await this.prisma.dish.findUnique({ where: { sku } });
    if (dish && dish.id !== ignoreDishId) {
      throw new BadRequestException('Dish SKU already exists');
    }
  }

  private async validateDishRelations(
    allergenIds: string[],
    dietaryTagIds: string[],
    categoryIds: string[],
    client: Prisma.TransactionClient = this.prisma,
  ) {
    if (allergenIds.length) {
      const allergens = await client.allergen.findMany({
        where: { id: { in: allergenIds } },
      });
      if (allergens.length !== new Set(allergenIds).size) {
        throw new BadRequestException('Unknown allergen');
      }
    }

    if (dietaryTagIds.length) {
      const dietaryTags = await client.dietaryTag.findMany({
        where: { id: { in: dietaryTagIds } },
      });
      if (dietaryTags.length !== new Set(dietaryTagIds).size) {
        throw new BadRequestException('Unknown dietary tag');
      }
    }

    if (categoryIds.length) {
      const categories = await client.category.findMany({
        where: { id: { in: categoryIds } },
      });
      if (categories.length !== new Set(categoryIds).size) {
        throw new BadRequestException('Unknown category');
      }
    }
  }

  private async validateOptionRelations(allergenIds: string[], dietaryTagIds: string[]) {
    if (allergenIds.length) {
      const allergens = await this.prisma.allergen.findMany({
        where: { id: { in: allergenIds } },
      });
      if (allergens.length !== new Set(allergenIds).size) {
        throw new BadRequestException('Unknown allergen');
      }
    }

    if (dietaryTagIds.length) {
      const dietaryTags = await this.prisma.dietaryTag.findMany({
        where: { id: { in: dietaryTagIds } },
      });
      if (dietaryTags.length !== new Set(dietaryTagIds).size) {
        throw new BadRequestException('Unknown dietary tag');
      }
    }
  }

  private toMoney(value: number | string): Prisma.Decimal {
    const numeric = typeof value === 'string' ? value : String(value);
    if (Number.isNaN(Number(numeric)) || Number(numeric) < 0) {
      throw new BadRequestException('Monetary value must be zero or greater');
    }

    return new Prisma.Decimal(numeric);
  }
}

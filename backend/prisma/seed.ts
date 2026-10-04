import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
dotenv.config({ path: '.env' });
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
console.log(
  'DATABASE_URL loaded:',
  process.env.DATABASE_URL ? 'YES' : 'NO',
);
const prisma = new PrismaClient({ adapter });

async function seedRolesAndPermissions() {

  const permissionDefinitions = [
    ['catalogue.read', 'View catalogue'],
    ['catalogue.manage', 'Manage catalogue'],

    ['pricing.read', 'View pricing'],
    ['pricing.manage', 'Manage pricing'],

    ['companies.read', 'View companies'],
    ['companies.manage', 'Manage companies'],

    ['employees.read', 'View employees'],
    ['employees.manage', 'Manage employees'],

    ['orders.read', 'View orders'],
    ['orders.create', 'Create orders'],
    ['orders.manage', 'Manage orders'],

    ['kitchen.read', 'View kitchen operations'],
    ['kitchen.manage', 'Manage kitchen operations'],

    ['dispatch.read', 'View dispatch operations'],
    ['dispatch.manage', 'Manage dispatch operations'],

    ['deliveries.readOwn', 'View assigned deliveries'],
    ['deliveries.manageOwn', 'Manage assigned deliveries'],

    ['billing.read', 'View billing'],
    ['billing.manage', 'Manage billing'],

    ['settings.read', 'View settings'],
    ['settings.manage', 'Manage settings'],

    ['dashboard.read', 'View dashboard'],
  ];

const permissions: Record<string, any> = {};

  for (const [key, description] of permissionDefinitions) {
    permissions[key] = await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: {
        key,
        description,
      },
    });
  }

  const roleDefinitions = {
    ADMIN: Object.keys(permissions),

    KITCHEN: [
      'catalogue.read',
      'companies.read',
      'employees.read',
      'orders.read',
      'kitchen.read',
      'kitchen.manage',
      'dashboard.read',
    ],

    DISPATCH: [
      'companies.read',
      'employees.read',
      'orders.read',
      'kitchen.read',
      'dispatch.read',
      'dispatch.manage',
      'dashboard.read',
    ],

    DRIVER: [
      'deliveries.readOwn',
      'deliveries.manageOwn',
      'dashboard.read',
    ],
  };

  const roles: Record<string, Awaited<ReturnType<typeof prisma.role.upsert>>> = {};

  for (const [roleName, permissionKeys] of Object.entries(roleDefinitions)) {

    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description: `${roleName} staff role`,
      },
    });

    roles[roleName] = role;

    for (const permissionKey of permissionKeys) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permissions[permissionKey].id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permissions[permissionKey].id,
        },
      });
    }
  }

  return roles;
}

async function seedStaffUsers(roles: Record<string, any>) {
  console.log('👤 Seeding staff users...');

  const passwordHash = await bcrypt.hash('Test@1234', 12);

  const users = [
    {
      email: 'admin@test.com',
      name: 'Admin User',
      roleName: 'ADMIN',
    },
    {
      email: 'kitchen@test.com',
      name: 'Kitchen User',
      roleName: 'KITCHEN',
    },
    {
      email: 'dispatch@test.com',
      name: 'Dispatch User',
      roleName: 'DISPATCH',
    },
    {
      email: 'driver@test.com',
      name: 'Driver User',
      roleName: 'DRIVER',
    },
  ];

  const seededUsers: Record<string, any> = {};

  for (const user of users) {
    seededUsers[user.email] = await prisma.user.upsert({
      where: {
        email: user.email,
      },

      update: {
        name: user.name,
        roleId: roles[user.roleName].id,
        passwordHash,
        active: true,
      },

      create: {
        email: user.email,
        name: user.name,
        passwordHash,
        roleId: roles[user.roleName].id,
        active: true,
      },
    });
  }

  console.log('✅ Staff users seeded');

  return seededUsers;
}

async function seedReferenceData() {
  console.log('📚 Seeding reference data...');

  // -----------------------------
  // Stations
  // -----------------------------
  const stations = [
    { name: 'Hot Kitchen' },
    { name: 'Cold Kitchen' },
    { name: 'Salad & Prep' },
    { name: 'Bakery & Desserts' },
    { name: 'Beverage' },
    { name: 'Unassigned' },
  ];

  for (const station of stations) {
    await prisma.station.upsert({
      where: {
        name: station.name,
      },
      update: {},
      create: station,
    });
  }

  // -----------------------------
  // Allergens
  // -----------------------------
  const allergens = [
    { name: 'Milk' },
    { name: 'Eggs' },
    { name: 'Peanuts' },
    { name: 'Tree Nuts' },
    { name: 'Soy' },
    { name: 'Wheat / Gluten' },
    { name: 'Sesame' },
    { name: 'Fish' },
    { name: 'Shellfish' },
    { name: 'Mustard' },
  ];

  for (const allergen of allergens) {
    await prisma.allergen.upsert({
      where: {
        name: allergen.name,
      },
      update: {},
      create: allergen,
    });
  }

  // -----------------------------
  // Dietary Tags
  // -----------------------------
  const dietaryTags = [
    { name: 'Vegetarian' },
    { name: 'Vegan' },
    { name: 'Gluten-Free' },
    { name: 'Dairy-Free' },
    { name: 'Low-Carb' },
    { name: 'High-Protein' },
    { name: 'Halal' },
  ];

  for (const tag of dietaryTags) {
    await prisma.dietaryTag.upsert({
      where: {
        name: tag.name,
      },
      update: {},
      create: tag,
    });
  }

  // -----------------------------
  // Portion Sizes
  // -----------------------------
  const portionSizes = [
    {
      name: 'Regular',
      displayOrder: 1,
    },
    {
      name: 'Large',
      displayOrder: 2,
    },
  ];

  for (const size of portionSizes) {
    await prisma.portionSize.upsert({
      where: {
        name: size.name,
      },
      update: {
        displayOrder: size.displayOrder,
      },
      create: size,
    });
  }

  console.log('✅ Reference data seeded');
}


async function main() {

  console.log('🌱 Starting database seed...');

  const roles = await seedRolesAndPermissions();

  await seedStaffUsers(roles);
    await seedReferenceData();
    await seedBusinessData();
    
  console.log('✅ Roles seeded');
  console.log(Object.keys(roles));

  console.log('✅ Seed complete');
}

async function seedBusinessData() {
  console.log('🍽️ Seeding business data...');

  // =========================================================
  // HELPERS
  // =========================================================

  const getStation = async (name: string) => {
    return prisma.station.findUniqueOrThrow({
      where: { name },
    });
  };

  const getAllergen = async (name: string) => {
    return prisma.allergen.findUniqueOrThrow({
      where: { name },
    });
  };

  const getDietaryTag = async (name: string) => {
    return prisma.dietaryTag.findUniqueOrThrow({
      where: { name },
    });
  };

  const getPortionSize = async (name: string) => {
    return prisma.portionSize.findUniqueOrThrow({
      where: { name },
    });
  };

  // =========================================================
  // PRICING TIERS
  // =========================================================

  console.log('💰 Seeding pricing tiers...');

  const standardTier = await prisma.$transaction(async (tx) => {
    await tx.pricingTier.updateMany({ data: { isDefault: false } });
    return tx.pricingTier.upsert({
      where: { name: 'Standard' },
      update: {
        isDefault: true,
        derivationType: 'NONE',
        derivationSourceTierId: null,
        derivationFactor: null,
      },
      create: {
        name: 'Standard',
        isDefault: true,
        derivationType: 'NONE',
      },
    });
  });

  const enterpriseTier = await prisma.pricingTier.upsert({
    where: { name: 'Enterprise' },
    update: {
      isDefault: false,
      derivationType: 'TIER_PERCENTAGE',
      derivationSourceTierId: standardTier.id,
      derivationFactor: '0.1500',
    },
    create: {
      name: 'Enterprise',
      isDefault: false,
      derivationType: 'TIER_PERCENTAGE',
      derivationSourceTierId: standardTier.id,
      derivationFactor: '0.1500',
    },
  });

  const partnerTier = await prisma.pricingTier.upsert({
    where: { name: 'Partner' },
    update: {
      isDefault: false,
      derivationType: 'TIER_PERCENTAGE',
      derivationSourceTierId: enterpriseTier.id,
      derivationFactor: '0.0500',
    },
    create: {
      name: 'Partner',
      isDefault: false,
      derivationType: 'TIER_PERCENTAGE',
      derivationSourceTierId: enterpriseTier.id,
      derivationFactor: '0.0500',
    },
  });

  // =========================================================
  // CATEGORIES
  // =========================================================

  console.log('📂 Seeding categories...');

  const categoryDefinitions = [
    { name: 'Signature Bowls', displayOrder: 1, secret: false },
    { name: 'Indian Mains', displayOrder: 2, secret: false },
    { name: 'Global Mains', displayOrder: 3, secret: false },
    { name: 'Fresh Salads', displayOrder: 4, secret: false },
    { name: 'Sides', displayOrder: 5, secret: false },
    { name: 'Desserts', displayOrder: 6, secret: false },
    { name: 'Beverages', displayOrder: 7, secret: false },
    {
      name: 'Chef Specials',
      displayOrder: 8,
      secret: true,
    },
  ];

  const categories: Record<string, any> = {};

  for (const category of categoryDefinitions) {
    categories[category.name] = await prisma.category.upsert({
      where: { name: category.name },
      update: {
        displayOrder: category.displayOrder,
        secret: category.secret,
        active: true,
      },
      create: {
        name: category.name,
        displayOrder: category.displayOrder,
        secret: category.secret,
        active: true,
      },
    });
  }

  // =========================================================
  // DISHES
  // =========================================================

  console.log('🥗 Seeding dishes...');

  const dishes = [
    {
      sku: 'FL-BWL-001',
      name: 'Paneer Tikka Rice Bowl',
      description:
        'Char-grilled paneer tikka with jeera rice, roasted vegetables and mint chutney.',
      temperature: 'HOT' as const,
      costPrice: '5.80',
      station: 'Hot Kitchen',
      category: 'Signature Bowls',
      dietaryTags: ['Vegetarian', 'High-Protein'],
      allergens: ['Milk'],
    },
    {
      sku: 'FL-BWL-002',
      name: 'Teriyaki Chicken Bowl',
      description:
        'Grilled chicken with steamed rice, edamame, broccoli and house teriyaki glaze.',
      temperature: 'HOT' as const,
      costPrice: '6.40',
      station: 'Hot Kitchen',
      category: 'Signature Bowls',
      dietaryTags: ['High-Protein'],
      allergens: ['Soy', 'Sesame'],
    },
    {
      sku: 'FL-BWL-003',
      name: 'Mediterranean Chickpea Bowl',
      description:
        'Herbed chickpeas, quinoa, cucumber, tomato, olives and lemon tahini dressing.',
      temperature: 'COLD' as const,
      costPrice: '5.20',
      station: 'Cold Kitchen',
      category: 'Signature Bowls',
      dietaryTags: ['Vegan', 'Vegetarian', 'Dairy-Free'],
      allergens: ['Sesame'],
    },
    {
      sku: 'FL-IND-001',
      name: 'Dal Makhani with Jeera Rice',
      description:
        'Slow-cooked black lentils finished with tomato, spices and cream, served with jeera rice.',
      temperature: 'HOT' as const,
      costPrice: '4.90',
      station: 'Hot Kitchen',
      category: 'Indian Mains',
      dietaryTags: ['Vegetarian', 'High-Protein'],
      allergens: ['Milk'],
    },
    {
      sku: 'FL-IND-002',
      name: 'Chicken Tikka Masala',
      description:
        'Tandoori chicken pieces in a mildly spiced tomato and cream gravy with basmati rice.',
      temperature: 'HOT' as const,
      costPrice: '6.30',
      station: 'Hot Kitchen',
      category: 'Indian Mains',
      dietaryTags: ['High-Protein', 'Halal'],
      allergens: ['Milk'],
    },
    {
      sku: 'FL-IND-003',
      name: 'Vegetable Thai Green Curry',
      description:
        'Seasonal vegetables in aromatic coconut green curry served with jasmine rice.',
      temperature: 'HOT' as const,
      costPrice: '5.60',
      station: 'Hot Kitchen',
      category: 'Global Mains',
      dietaryTags: ['Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
      allergens: ['Soy'],
    },
    {
      sku: 'FL-GLB-001',
      name: 'Roasted Vegetable Couscous',
      description:
        'Pearl couscous with roasted seasonal vegetables, herbs and lemon dressing.',
      temperature: 'HOT' as const,
      costPrice: '5.10',
      station: 'Hot Kitchen',
      category: 'Global Mains',
      dietaryTags: ['Vegetarian'],
      allergens: ['Wheat / Gluten'],
    },
    {
      sku: 'FL-GLB-002',
      name: 'Grilled Chicken Pesto Pasta',
      description:
        'Grilled chicken, fusilli pasta, basil pesto and roasted cherry tomatoes.',
      temperature: 'HOT' as const,
      costPrice: '6.20',
      station: 'Hot Kitchen',
      category: 'Global Mains',
      dietaryTags: ['High-Protein'],
      allergens: ['Wheat / Gluten', 'Milk', 'Tree Nuts'],
    },
    {
      sku: 'FL-SAL-001',
      name: 'Grilled Chicken Caesar Salad',
      description:
        'Romaine lettuce, grilled chicken, parmesan, croutons and Caesar dressing.',
      temperature: 'COLD' as const,
      costPrice: '5.70',
      station: 'Cold Kitchen',
      category: 'Fresh Salads',
      dietaryTags: ['High-Protein'],
      allergens: ['Milk', 'Eggs', 'Wheat / Gluten'],
    },
    {
      sku: 'FL-SAL-002',
      name: 'Avocado Quinoa Garden Salad',
      description:
        'Quinoa, avocado, cucumber, tomato, greens and citrus herb dressing.',
      temperature: 'COLD' as const,
      costPrice: '5.40',
      station: 'Salad & Prep',
      category: 'Fresh Salads',
      dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free'],
      allergens: [],
    },
    {
      sku: 'FL-SID-001',
      name: 'Garlic Herb Roasted Potatoes',
      description:
        'Crispy roasted potatoes with garlic, parsley and herbs.',
      temperature: 'HOT' as const,
      costPrice: '2.10',
      station: 'Hot Kitchen',
      category: 'Sides',
      dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free'],
      allergens: [],
    },
    {
      sku: 'FL-SID-002',
      name: 'Seasonal Steamed Vegetables',
      description:
        'Broccoli, carrots, beans and seasonal vegetables lightly seasoned.',
      temperature: 'HOT' as const,
      costPrice: '2.00',
      station: 'Salad & Prep',
      category: 'Sides',
      dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free'],
      allergens: [],
    },
    {
      sku: 'FL-DES-001',
      name: 'Dark Chocolate Brownie',
      description:
        'Rich dark chocolate brownie with a soft centre.',
      temperature: 'COLD' as const,
      costPrice: '2.20',
      station: 'Bakery & Desserts',
      category: 'Desserts',
      dietaryTags: ['Vegetarian'],
      allergens: ['Milk', 'Eggs', 'Wheat / Gluten'],
    },
    {
      sku: 'FL-DES-002',
      name: 'Mango Chia Pudding',
      description:
        'Chia pudding layered with fresh mango and coconut cream.',
      temperature: 'COLD' as const,
      costPrice: '2.40',
      station: 'Bakery & Desserts',
      category: 'Desserts',
      dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free'],
      allergens: [],
    },
    {
      sku: 'FL-BEV-001',
      name: 'Fresh Lime Mint Cooler',
      description:
        'Fresh lime, mint and lightly sweetened chilled water.',
      temperature: 'COLD' as const,
      costPrice: '1.20',
      station: 'Beverage',
      category: 'Beverages',
      dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free'],
      allergens: [],
    },
    {
      sku: 'FL-BEV-002',
      name: 'Cold Brew Coffee',
      description:
        'Smooth slow-brewed coffee served chilled.',
      temperature: 'COLD' as const,
      costPrice: '1.50',
      station: 'Beverage',
      category: 'Beverages',
      dietaryTags: ['Vegan', 'Vegetarian', 'Dairy-Free'],
      allergens: [],
    },
    {
      sku: 'FL-SPC-001',
      name: 'Chef Special Harissa Chicken',
      description:
        'Roasted harissa chicken with couscous, charred vegetables and herb yogurt.',
      temperature: 'HOT' as const,
      costPrice: '7.10',
      station: 'Hot Kitchen',
      category: 'Chef Specials',
      dietaryTags: ['High-Protein', 'Halal'],
      allergens: ['Milk', 'Wheat / Gluten'],
    },
  ];

  const dishMap: Record<string, any> = {};

  for (const dishData of dishes) {
    const station = await getStation(dishData.station);

    const dish = await prisma.dish.upsert({
      where: { sku: dishData.sku },
      update: {
        name: dishData.name,
        description: dishData.description,
        temperature: dishData.temperature,
        costPrice: dishData.costPrice,
        stationId: station.id,
        active: true,
      },
      create: {
        sku: dishData.sku,
        name: dishData.name,
        description: dishData.description,
        temperature: dishData.temperature,
        costPrice: dishData.costPrice,
        stationId: station.id,
        active: true,
        minimumOrderQuantity: 1,
      },
    });

    dishMap[dishData.sku] = dish;

    const category = categories[dishData.category];

    await prisma.categoryDish.upsert({
      where: {
        categoryId_dishId: {
          categoryId: category.id,
          dishId: dish.id,
        },
      },
      update: {
        displayOrder: 1,
      },
      create: {
        categoryId: category.id,
        dishId: dish.id,
        displayOrder: 1,
      },
    });

    for (const allergenName of dishData.allergens) {
      const allergen = await getAllergen(allergenName);

      await prisma.dishAllergen.upsert({
        where: {
          dishId_allergenId: {
            dishId: dish.id,
            allergenId: allergen.id,
          },
        },
        update: {},
        create: {
          dishId: dish.id,
          allergenId: allergen.id,
        },
      });
    }

    for (const tagName of dishData.dietaryTags) {
      const tag = await getDietaryTag(tagName);

      await prisma.dishDietaryTag.upsert({
        where: {
          dishId_dietaryTagId: {
            dishId: dish.id,
            dietaryTagId: tag.id,
          },
        },
        update: {},
        create: {
          dishId: dish.id,
          dietaryTagId: tag.id,
        },
      });
    }
  }

  // =========================================================
  // OPTIONS
  // =========================================================

  console.log('🥣 Seeding reusable options...');

  const optionDefinitions = [
    {
      name: 'Grilled Chicken',
      description: 'Herb-marinated grilled chicken.',
      costPrice: '2.40',
      allergens: [],
      dietaryTags: ['High-Protein', 'Halal'],
    },
    {
      name: 'Paneer',
      description: 'Char-grilled Indian cottage cheese.',
      costPrice: '2.00',
      allergens: ['Milk'],
      dietaryTags: ['Vegetarian', 'High-Protein'],
    },
    {
      name: 'Falafel',
      description: 'Crispy chickpea and herb falafel.',
      costPrice: '1.80',
      allergens: ['Sesame'],
      dietaryTags: ['Vegan', 'Vegetarian', 'Dairy-Free'],
    },
    {
      name: 'Quinoa',
      description: 'Herbed cooked quinoa.',
      costPrice: '1.40',
      allergens: [],
      dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free'],
    },
    {
      name: 'Jeera Rice',
      description: 'Basmati rice tempered with cumin.',
      costPrice: '1.00',
      allergens: [],
      dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free'],
    },
    {
      name: 'Mixed Greens',
      description: 'Fresh seasonal salad greens.',
      costPrice: '0.80',
      allergens: [],
      dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free'],
    },
    {
      name: 'Mint Yogurt',
      description: 'Cooling mint and yogurt sauce.',
      costPrice: '0.70',
      allergens: ['Milk'],
      dietaryTags: ['Vegetarian'],
    },
    {
      name: 'Green Chutney',
      description: 'Fresh coriander, mint and green chilli chutney.',
      costPrice: '0.50',
      allergens: [],
      dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free'],
    },
    {
      name: 'Tahini Dressing',
      description: 'Creamy sesame and lemon dressing.',
      costPrice: '0.80',
      allergens: ['Sesame'],
      dietaryTags: ['Vegan', 'Vegetarian', 'Dairy-Free'],
    },
    {
      name: 'Extra Avocado',
      description: 'Fresh sliced avocado.',
      costPrice: '1.20',
      allergens: [],
      dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free'],
    },
  ];

  const optionMap: Record<string, any> = {};

  for (const optionData of optionDefinitions) {
    let option = await prisma.option.findFirst({
      where: {
        name: optionData.name,
      },
    });

    if (!option) {
      option = await prisma.option.create({
        data: {
          name: optionData.name,
          description: optionData.description,
          costPrice: optionData.costPrice,
          active: true,
        },
      });
    } else {
      option = await prisma.option.update({
        where: { id: option.id },
        data: {
          description: optionData.description,
          costPrice: optionData.costPrice,
          active: true,
        },
      });
    }

    optionMap[optionData.name] = option;

    for (const allergenName of optionData.allergens) {
      const allergen = await getAllergen(allergenName);

      await prisma.optionAllergen.upsert({
        where: {
          optionId_allergenId: {
            optionId: option.id,
            allergenId: allergen.id,
          },
        },
        update: {},
        create: {
          optionId: option.id,
          allergenId: allergen.id,
        },
      });
    }

    for (const tagName of optionData.dietaryTags) {
      const tag = await getDietaryTag(tagName);

      await prisma.optionDietaryTag.upsert({
        where: {
          optionId_dietaryTagId: {
            optionId: option.id,
            dietaryTagId: tag.id,
          },
        },
        update: {},
        create: {
          optionId: option.id,
          dietaryTagId: tag.id,
        },
      });
    }
  }

  // =========================================================
  // OPTION GROUPS
  // =========================================================

  console.log('🔧 Seeding option groups...');

  const regularSize = await getPortionSize('Regular');
  const largeSize = await getPortionSize('Large');

  const optionGroupDefinitions = [
    {
      sku: 'FL-BWL-001',
      groups: [
        {
          name: 'Protein',
          required: true,
          options: ['Paneer', 'Grilled Chicken', 'Falafel'],
        },
        {
          name: 'Base',
          required: true,
          options: ['Jeera Rice', 'Quinoa'],
        },
        {
          name: 'Sauce',
          required: false,
          options: ['Mint Yogurt', 'Green Chutney'],
        },
      ],
    },
    {
      sku: 'FL-BWL-002',
      groups: [
        {
          name: 'Protein',
          required: true,
          options: ['Grilled Chicken', 'Paneer', 'Falafel'],
        },
        {
          name: 'Base',
          required: true,
          options: ['Jeera Rice', 'Quinoa'],
        },
        {
          name: 'Sauce',
          required: false,
          options: ['Green Chutney', 'Tahini Dressing'],
        },
      ],
    },
    {
      sku: 'FL-BWL-003',
      groups: [
        {
          name: 'Base',
          required: true,
          options: ['Quinoa', 'Mixed Greens'],
        },
        {
          name: 'Dressing',
          required: false,
          options: ['Tahini Dressing', 'Green Chutney'],
        },
        {
          name: 'Add-on',
          required: false,
          options: ['Extra Avocado', 'Falafel'],
        },
      ],
    },
    {
      sku: 'FL-SAL-002',
      groups: [
        {
          name: 'Base',
          required: true,
          options: ['Quinoa', 'Mixed Greens'],
        },
        {
          name: 'Dressing',
          required: false,
          options: ['Tahini Dressing', 'Green Chutney'],
        },
        {
          name: 'Add-on',
          required: false,
          options: ['Extra Avocado', 'Falafel'],
        },
      ],
    },
  ];

  for (const definition of optionGroupDefinitions) {
    const dish = dishMap[definition.sku];

    for (let groupIndex = 0; groupIndex < definition.groups.length; groupIndex++) {
      const groupData = definition.groups[groupIndex];

      const group = await prisma.optionGroup.upsert({
        where: {
          dishId_name: {
            dishId: dish.id,
            name: groupData.name,
          },
        },
        update: {
          required: groupData.required,
          displayOrder: groupIndex + 1,
        },
        create: {
          dishId: dish.id,
          name: groupData.name,
          required: groupData.required,
          displayOrder: groupIndex + 1,
        },
      });

      await prisma.optionGroupSize.upsert({
        where: {
          optionGroupId_portionSizeId: {
            optionGroupId: group.id,
            portionSizeId: regularSize.id,
          },
        },
        update: {},
        create: {
          optionGroupId: group.id,
          portionSizeId: regularSize.id,
        },
      });

      await prisma.optionGroupSize.upsert({
        where: {
          optionGroupId_portionSizeId: {
            optionGroupId: group.id,
            portionSizeId: largeSize.id,
          },
        },
        update: {},
        create: {
          optionGroupId: group.id,
          portionSizeId: largeSize.id,
        },
      });

      for (
        let optionIndex = 0;
        optionIndex < groupData.options.length;
        optionIndex++
      ) {
        const option = optionMap[groupData.options[optionIndex]];

        await prisma.optionGroupOption.upsert({
          where: {
            optionGroupId_optionId: {
              optionGroupId: group.id,
              optionId: option.id,
            },
          },
          update: {
            displayOrder: optionIndex + 1,
          },
          create: {
            optionGroupId: group.id,
            optionId: option.id,
            displayOrder: optionIndex + 1,
          },
        });

        // Every option in this group supports every group size.
        await prisma.optionGroupOptionSize.upsert({
          where: {
            optionGroupId_optionId_portionSizeId: {
              optionGroupId: group.id,
              optionId: option.id,
              portionSizeId: regularSize.id,
            },
          },
          update: {
            extraCharge: '0.00',
          },
          create: {
            optionGroupId: group.id,
            optionId: option.id,
            portionSizeId: regularSize.id,
            extraCharge: '0.00',
          },
        });

        await prisma.optionGroupOptionSize.upsert({
          where: {
            optionGroupId_optionId_portionSizeId: {
              optionGroupId: group.id,
              optionId: option.id,
              portionSizeId: largeSize.id,
            },
          },
          update: {
            extraCharge: optionIndex === 0 ? '0.50' : '0.75',
          },
          create: {
            optionGroupId: group.id,
            optionId: option.id,
            portionSizeId: largeSize.id,
            extraCharge: optionIndex === 0 ? '0.50' : '0.75',
          },
        });
      }

      
    }
  }

  // =========================================================
  // DISH PRICES
  // =========================================================

  console.log('💵 Seeding dish prices...');

  await prisma.dishPrice.deleteMany({
    where: { pricingTierId: { in: [enterpriseTier.id, partnerTier.id] } },
  });
  await prisma.optionPrice.deleteMany({
    where: { pricingTierId: { in: [enterpriseTier.id, partnerTier.id] } },
  });

  for (const dish of dishes) {
    const dbDish = dishMap[dish.sku];
    const standardPrice = new Prisma.Decimal(dish.costPrice).mul('1.75').toFixed(2);

    if (['FL-BEV-002', 'FL-DES-002'].includes(dish.sku)) {
      await prisma.dishPrice.deleteMany({
        where: { dishId: dbDish.id, pricingTierId: standardTier.id },
      });
      continue;
    }

    await prisma.dishPrice.upsert({
      where: {
        dishId_pricingTierId: {
          dishId: dbDish.id,
          pricingTierId: standardTier.id,
        },
      },
      update: {
        price: standardPrice,
        source: 'MANUAL',
      },
      create: {
        dishId: dbDish.id,
        pricingTierId: standardTier.id,
        price: standardPrice,
        source: 'MANUAL',
      },
    });
  }

  const overrideDish = dishes.find((dish) => !['FL-BEV-002', 'FL-DES-002'].includes(dish.sku));
  if (overrideDish) {
    const dbDish = dishMap[overrideDish.sku];
    await prisma.dishPrice.create({
      data: {
        dishId: dbDish.id,
        pricingTierId: enterpriseTier.id,
        price: new Prisma.Decimal(dishMap[overrideDish.sku].costPrice).mul('2.25').toFixed(2),
        source: 'OVERRIDE',
      },
    });
  }

  // =========================================================
  // OPTION PRICES
  // =========================================================

  console.log('💲 Seeding option prices...');

  for (const optionData of optionDefinitions) {
    const option = optionMap[optionData.name];
    const standardPrice = new Prisma.Decimal(optionData.costPrice).mul('1.8').toFixed(2);

    await prisma.optionPrice.upsert({
      where: {
        optionId_pricingTierId: {
          optionId: option.id,
          pricingTierId: standardTier.id,
        },
      },
      update: {
        price: standardPrice,
        source: 'MANUAL',
      },
      create: {
        optionId: option.id,
        pricingTierId: standardTier.id,
        price: standardPrice,
        source: 'MANUAL',
      },
    });
  }

  const overrideOptionData = optionDefinitions[0];
  if (overrideOptionData) {
    const overrideOption = optionMap[overrideOptionData.name];
    await prisma.optionPrice.create({
      data: {
        optionId: overrideOption.id,
        pricingTierId: enterpriseTier.id,
        price: new Prisma.Decimal(overrideOptionData.costPrice).mul('2.1').toFixed(2),
        source: 'OVERRIDE',
      },
    });
  }

  console.log('✅ Catalogue and pricing seeded');

  // =========================================================
  // COMPANIES
  // =========================================================

  console.log('🏢 Seeding companies...');

  const driver = await prisma.user.findUniqueOrThrow({
    where: { email: 'driver@test.com' },
  });

  const companyDefinitions = [
    {
      name: 'Northstar Finance',
      domain: 'northstarfinance.com',
      tierId: null,
      billingName: 'Priya Shah',
      billingEmail: 'accounts@northstarfinance.com',
      billingPhone: '+1 415 555 0142',
      deliveryTime: '12:15',
      packaging: 'Standard individual boxes',
      instructions: 'Leave deliveries with the reception desk.',
    },
    {
      name: 'Vertex Consulting',
      domain: 'vertexconsulting.com',
      tierId: enterpriseTier.id,
      billingName: 'Daniel Morgan',
      billingEmail: 'billing@vertexconsulting.com',
      billingPhone: '+1 415 555 0168',
      deliveryTime: '12:30',
      packaging: 'Compostable individual boxes',
      instructions: 'Call reception on arrival.',
    },
    {
      name: 'BluePeak Systems',
      domain: 'bluepeaksystems.com',
      tierId: enterpriseTier.id,
      billingName: 'Maya Patel',
      billingEmail: 'finance@bluepeaksystems.com',
      billingPhone: '+1 415 555 0184',
      deliveryTime: '12:00',
      packaging: 'Premium insulated packaging',
      instructions: 'Use loading entrance on Market Street.',
    },
    {
      name: 'Harbor Health',
      domain: 'harborhealth.org',
      tierId: standardTier.id,
      billingName: 'James Wilson',
      billingEmail: 'billing@harborhealth.org',
      billingPhone: '+1 415 555 0191',
      deliveryTime: '12:45',
      packaging: 'Standard individual boxes',
      instructions: 'Security will direct driver to the staff entrance.',
    },
  ];

  const companyMap: Record<string, any> = {};

  for (const companyData of companyDefinitions) {
    let company = await prisma.company.findFirst({
      where: { name: companyData.name },
    });

    if (!company) {
      company = await prisma.company.create({
        data: {
          name: companyData.name,
          billingContactName: companyData.billingName,
          billingContactEmail: companyData.billingEmail,
          billingContactPhone: companyData.billingPhone,
          priceTierId: companyData.tierId,
          defaultDeliveryTime: companyData.deliveryTime,
          deliveryLeadMinutes: 60,
          defaultPackaging: companyData.packaging,
          driverInstructions: companyData.instructions,
          defaultDriverId: driver.id,
          active: true,
          ...(companyData.name === 'Vertex Consulting' ? { saturdayEnabled: true } : {}),
          ...(companyData.name === 'BluePeak Systems' ? { deliveryLeadMinutes: 90 } : {}),
        },
      });
    } else {
      company = await prisma.company.update({
        where: { id: company.id },
        data: {
          billingContactName: companyData.billingName,
          billingContactEmail: companyData.billingEmail,
          billingContactPhone: companyData.billingPhone,
          priceTierId: companyData.tierId,
          defaultDeliveryTime: companyData.deliveryTime,
          deliveryLeadMinutes: 60,
          defaultPackaging: companyData.packaging,
          driverInstructions: companyData.instructions,
          defaultDriverId: driver.id,
          active: true,
          ...(companyData.name === 'Vertex Consulting' ? { saturdayEnabled: true } : {}),
          ...(companyData.name === 'BluePeak Systems' ? { deliveryLeadMinutes: 90 } : {}),
        },
      });
    }

    companyMap[company.name] = company;

    await prisma.companyEmailDomain.upsert({
      where: {
        companyId_domain: {
          companyId: company.id,
          domain: companyData.domain,
        },
      },
      update: {},
      create: {
        companyId: company.id,
        domain: companyData.domain,
      },
    });
  }

  // =========================================================
  // COMPANY ADDRESSES
  // =========================================================

  const addressDefinitions = [
    {
      company: 'Northstar Finance',
      label: 'Downtown HQ',
      line1: '450 Montgomery Street',
      line2: 'Floor 8',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94104',
    },
    {
      company: 'Vertex Consulting',
      label: 'Market Street Office',
      line1: '101 Market Street',
      line2: 'Suite 1200',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
    },
    {
      company: 'BluePeak Systems',
      label: 'SoMa Headquarters',
      line1: '250 2nd Street',
      line2: 'Floor 5',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
    },
    {
      company: 'Harbor Health',
      label: 'Medical Center Office',
      line1: '700 Mission Street',
      line2: 'Building B',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94103',
    },
  ];

  const addressMap: Record<string, any> = {};

  for (const addressData of addressDefinitions) {
    const company = companyMap[addressData.company];

    let address = await prisma.companyAddress.findFirst({
      where: {
        companyId: company.id,
        label: addressData.label,
      },
    });

    if (!address) {
      address = await prisma.companyAddress.create({
        data: {
          companyId: company.id,
          label: addressData.label,
          line1: addressData.line1,
          line2: addressData.line2,
          city: addressData.city,
          state: addressData.state,
          postalCode: addressData.postalCode,
          country: 'USA',
          active: true,
        },
      });
    }

    addressMap[addressData.company] = address;
  }

  // =========================================================
  // EMPLOYEES
  // =========================================================

  console.log('👥 Seeding employees...');

  const employeeDefinitions = [
    {
      company: 'Northstar Finance',
      name: 'Ava Richardson',
      email: 'ava.richardson@northstarfinance.com',
      phone: '+1 415 555 0201',
      address: true,
      time: true,
      packaging: true,
    },
    {
      company: 'Northstar Finance',
      name: 'Ethan Brooks',
      email: 'ethan.brooks@northstarfinance.com',
      phone: '+1 415 555 0202',
      address: false,
      time: false,
      packaging: false,
    },
    {
      company: 'Northstar Finance',
      name: 'Sophia Chen',
      email: 'sophia.chen@northstarfinance.com',
      phone: '+1 415 555 0203',
      address: true,
      time: false,
      packaging: true,
    },
    {
      company: 'Vertex Consulting',
      name: 'Liam Carter',
      email: 'liam.carter@vertexconsulting.com',
      phone: '+1 415 555 0211',
      address: true,
      time: true,
      packaging: false,
    },
    {
      company: 'Vertex Consulting',
      name: 'Olivia Martinez',
      email: 'olivia.martinez@vertexconsulting.com',
      phone: '+1 415 555 0212',
      address: false,
      time: false,
      packaging: true,
    },
    {
      company: 'Vertex Consulting',
      name: 'Noah Williams',
      email: 'noah.williams@vertexconsulting.com',
      phone: '+1 415 555 0213',
      address: false,
      time: true,
      packaging: false,
    },
    {
      company: 'BluePeak Systems',
      name: 'Emma Patel',
      email: 'emma.patel@bluepeaksystems.com',
      phone: '+1 415 555 0221',
      address: true,
      time: true,
      packaging: true,
    },
    {
      company: 'BluePeak Systems',
      name: 'Lucas Anderson',
      email: 'lucas.anderson@bluepeaksystems.com',
      phone: '+1 415 555 0222',
      address: false,
      time: false,
      packaging: false,
    },
    {
      company: 'BluePeak Systems',
      name: 'Mia Thompson',
      email: 'mia.thompson@bluepeaksystems.com',
      phone: '+1 415 555 0223',
      address: true,
      time: false,
      packaging: true,
    },
    {
      company: 'Harbor Health',
      name: 'James Taylor',
      email: 'james.taylor@harborhealth.org',
      phone: '+1 415 555 0231',
      address: false,
      time: false,
      packaging: false,
    },
    {
      company: 'Harbor Health',
      name: 'Isabella Moore',
      email: 'isabella.moore@harborhealth.org',
      phone: '+1 415 555 0232',
      address: true,
      time: true,
      packaging: true,
    },
    {
      company: 'Harbor Health',
      name: 'Benjamin Davis',
      email: 'benjamin.davis@harborhealth.org',
      phone: '+1 415 555 0233',
      address: false,
      time: true,
      packaging: false,
    },
  ];

  const employeeMap: Record<string, any> = {};

  for (const employeeData of employeeDefinitions) {
    const company = companyMap[employeeData.company];

    let employee = await prisma.employee.findFirst({
      where: {
        companyId: company.id,
        email: employeeData.email,
      },
    });

    if (!employee) {
      employee = await prisma.employee.create({
        data: {
          companyId: company.id,
          name: employeeData.name,
          email: employeeData.email,
          phone: employeeData.phone,
          canChooseAddress: employeeData.address,
          canChangeDeliveryTime: employeeData.time,
          canChangePackaging: employeeData.packaging,
        },
      });
    } else {
      employee = await prisma.employee.update({
        where: { id: employee.id },
        data: {
          name: employeeData.name,
          phone: employeeData.phone,
          canChooseAddress: employeeData.address,
          canChangeDeliveryTime: employeeData.time,
          canChangePackaging: employeeData.packaging,
        },
      });
    }

    employeeMap[employeeData.email] = employee;
  }

  // Company owners
 const ownerAssignments = [
  ['Northstar Finance', 'ava.richardson@northstarfinance.com'],
  ['Vertex Consulting', 'liam.carter@vertexconsulting.com'],
  ['BluePeak Systems', 'emma.patel@bluepeaksystems.com'],
  ['Harbor Health', 'isabella.moore@harborhealth.org'],
];

  for (const [companyName, email] of ownerAssignments) {
    const company = companyMap[companyName];
    const employee = employeeMap[email];

    await prisma.company.update({
      where: { id: company.id },
      data: {
        ownerEmployeeId: employee.id,
      },
    });
  }

  const companyHolidayDefinitions = [
    { company: 'Northstar Finance', date: new Date('2026-11-26T00:00:00.000Z'), name: 'Thanksgiving closure' },
    { company: 'Vertex Consulting', date: new Date('2026-12-25T00:00:00.000Z'), name: 'Winter holiday' },
    { company: 'BluePeak Systems', date: new Date('2026-11-11T00:00:00.000Z'), name: 'Company planning day' },
    { company: 'Harbor Health', date: new Date('2026-12-25T00:00:00.000Z'), name: 'Christmas closure' },
  ];

  for (const holiday of companyHolidayDefinitions) {
    const company = companyMap[holiday.company];
    await prisma.companyHoliday.upsert({
      where: {
        companyId_date: {
          companyId: company.id,
          date: holiday.date,
        },
      },
      update: { name: holiday.name },
      create: {
        companyId: company.id,
        date: holiday.date,
        name: holiday.name,
      },
    });
  }

  // =========================================================
  // EMPLOYEE ALLERGIES / DIETARY PREFERENCES
  // =========================================================

  const employeePreferences = [
    {
      email: 'ethan.brooks@northstarfinance.com',
      allergies: ['Peanuts'],
      dietary: [],
    },
    {
      email: 'sophia.chen@northstarfinance.com',
      allergies: ['Milk'],
      dietary: ['Vegetarian'],
    },
    {
      email: 'olivia.martinez@vertexconsulting.com',
      allergies: ['Tree Nuts'],
      dietary: ['Vegan', 'Dairy-Free'],
    },
    {
      email: 'noah.williams@vertexconsulting.com',
      allergies: [],
      dietary: ['High-Protein'],
    },
    {
      email: 'lucas.anderson@bluepeaksystems.com',
      allergies: ['Sesame'],
      dietary: ['Gluten-Free'],
    },
    {
      email: 'mia.thompson@bluepeaksystems.com',
      allergies: ['Shellfish'],
      dietary: [],
    },
    {
      email: 'james.taylor@harborhealth.org',
      allergies: ['Eggs'],
      dietary: ['Low-Carb'],
    },
    {
      email: 'benjamin.davis@harborhealth.org',
      allergies: [],
      dietary: ['Vegetarian'],
    },
  ];

  for (const preference of employeePreferences) {
    const employee = employeeMap[preference.email];

    for (const allergenName of preference.allergies) {
      const allergen = await getAllergen(allergenName);

      await prisma.employeeAllergy.upsert({
        where: {
          employeeId_allergenId: {
            employeeId: employee.id,
            allergenId: allergen.id,
          },
        },
        update: {},
        create: {
          employeeId: employee.id,
          allergenId: allergen.id,
        },
      });
    }

    for (const tagName of preference.dietary) {
      const tag = await getDietaryTag(tagName);

      await prisma.employeeDietaryPreference.upsert({
        where: {
          employeeId_dietaryTagId: {
            employeeId: employee.id,
            dietaryTagId: tag.id,
          },
        },
        update: {},
        create: {
          employeeId: employee.id,
          dietaryTagId: tag.id,
        },
      });
    }
  }

  // =========================================================
  // COMPANY VISIBILITY
  // =========================================================

  console.log('👁️ Seeding menu visibility...');

  // Hide Chef Specials from Northstar.
  const northstar = companyMap['Northstar Finance'];
  const chefSpecials = categories['Chef Specials'];

  await prisma.companyCategoryVisibility.upsert({
    where: {
      companyId_categoryId: {
        companyId: northstar.id,
        categoryId: chefSpecials.id,
      },
    },
    update: {
      visible: false,
    },
    create: {
      companyId: northstar.id,
      categoryId: chefSpecials.id,
      visible: false,
    },
  });

  // Hide one dish from Vertex.
  const vertex = companyMap['Vertex Consulting'];
  const brownie = dishMap['FL-DES-001'];

  await prisma.companyDishVisibility.upsert({
    where: {
      companyId_dishId: {
        companyId: vertex.id,
        dishId: brownie.id,
      },
    },
    update: {
      visible: false,
    },
    create: {
      companyId: vertex.id,
      dishId: brownie.id,
      visible: false,
    },
  });

  // =========================================================
  // COMPANY HOLIDAYS
  // =========================================================

  const companyHolidayDate = new Date('2026-12-24T00:00:00.000Z');

  for (const company of Object.values(companyMap)) {
    await prisma.companyHoliday.upsert({
      where: {
        companyId_date: {
          companyId: company.id,
          date: companyHolidayDate,
        },
      },
      update: {
        name: 'Company Winter Closure',
      },
      create: {
        companyId: company.id,
        date: companyHolidayDate,
        name: 'Company Winter Closure',
      },
    });
  }

  // =========================================================
  // KITCHEN SETTINGS
  // =========================================================

  console.log('⚙️ Seeding kitchen settings...');

  await prisma.kitchenSetting.upsert({
    where: { id: 1 },
    update: {
      cutoffTime: '16:00',
      cutoffWorkingDays: 2,
      mondayEnabled: true,
      tuesdayEnabled: true,
      wednesdayEnabled: true,
      thursdayEnabled: true,
      fridayEnabled: true,
      saturdayEnabled: false,
      sundayEnabled: false,
      timezone: 'America/Los_Angeles',
    },
    create: {
      id: 1,
      cutoffTime: '16:00',
      cutoffWorkingDays: 2,
      mondayEnabled: true,
      tuesdayEnabled: true,
      wednesdayEnabled: true,
      thursdayEnabled: true,
      fridayEnabled: true,
      saturdayEnabled: false,
      sundayEnabled: false,
      timezone: 'America/Los_Angeles',
    },
  });

  await prisma.kitchenHoliday.upsert({
    where: {
      date: new Date('2026-12-25T00:00:00.000Z'),
    },
    update: {
      name: 'Christmas Day',
    },
    create: {
      date: new Date('2026-12-25T00:00:00.000Z'),
      name: 'Christmas Day',
    },
  });

  console.log('✅ Companies, employees and settings seeded');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  
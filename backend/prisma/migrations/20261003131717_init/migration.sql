-- CreateEnum
CREATE TYPE "Temperature" AS ENUM ('HOT', 'COLD');

-- CreateEnum
CREATE TYPE "PricingDerivationType" AS ENUM ('NONE', 'COST_FACTOR', 'TIER_PERCENTAGE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PLACED', 'CONFIRMED', 'DELIVERED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KitchenPrepStatus" AS ENUM ('PENDING', 'STARTED', 'DONE');

-- CreateEnum
CREATE TYPE "DropStatus" AS ENUM ('KITCHEN_READY', 'DISPATCH_READY', 'OUT_FOR_DELIVERY', 'DELIVERED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'PAID');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "ownerEmployeeId" UUID,
    "billingContactName" TEXT,
    "billingContactEmail" TEXT,
    "billingContactPhone" TEXT,
    "priceTierId" UUID,
    "defaultDeliveryTime" TEXT,
    "deliveryLeadMinutes" INTEGER NOT NULL DEFAULT 60,
    "defaultPackaging" TEXT,
    "driverInstructions" TEXT,
    "defaultDriverId" UUID,
    "mondayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tuesdayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "wednesdayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "thursdayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fridayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "saturdayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sundayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyEmailDomain" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "domain" TEXT NOT NULL,

    CONSTRAINT "CompanyEmailDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAddress" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "canChooseAddress" BOOLEAN NOT NULL DEFAULT false,
    "canChangeDeliveryTime" BOOLEAN NOT NULL DEFAULT false,
    "canChangePackaging" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAllergy" (
    "employeeId" UUID NOT NULL,
    "allergenId" UUID NOT NULL,

    CONSTRAINT "EmployeeAllergy_pkey" PRIMARY KEY ("employeeId","allergenId")
);

-- CreateTable
CREATE TABLE "EmployeeDietaryPreference" (
    "employeeId" UUID NOT NULL,
    "dietaryTagId" UUID NOT NULL,

    CONSTRAINT "EmployeeDietaryPreference_pkey" PRIMARY KEY ("employeeId","dietaryTagId")
);

-- CreateTable
CREATE TABLE "Dish" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "sku" TEXT NOT NULL,
    "temperature" "Temperature" NOT NULL,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "stationId" UUID NOT NULL,
    "minimumOrderQuantity" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allergen" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Allergen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietaryTag" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "DietaryTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Station" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Option" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionAllergen" (
    "optionId" UUID NOT NULL,
    "allergenId" UUID NOT NULL,

    CONSTRAINT "OptionAllergen_pkey" PRIMARY KEY ("optionId","allergenId")
);

-- CreateTable
CREATE TABLE "OptionDietaryTag" (
    "optionId" UUID NOT NULL,
    "dietaryTagId" UUID NOT NULL,

    CONSTRAINT "OptionDietaryTag_pkey" PRIMARY KEY ("optionId","dietaryTagId")
);

-- CreateTable
CREATE TABLE "OptionGroup" (
    "id" UUID NOT NULL,
    "dishId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OptionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionGroupOption" (
    "optionGroupId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OptionGroupOption_pkey" PRIMARY KEY ("optionGroupId","optionId")
);

-- CreateTable
CREATE TABLE "PortionSize" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PortionSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionGroupSize" (
    "optionGroupId" UUID NOT NULL,
    "portionSizeId" UUID NOT NULL,

    CONSTRAINT "OptionGroupSize_pkey" PRIMARY KEY ("optionGroupId","portionSizeId")
);

-- CreateTable
CREATE TABLE "OptionGroupOptionSize" (
    "optionGroupId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "portionSizeId" UUID NOT NULL,
    "extraCharge" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "OptionGroupOptionSize_pkey" PRIMARY KEY ("optionGroupId","optionId","portionSizeId")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "secret" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryDish" (
    "categoryId" UUID NOT NULL,
    "dishId" UUID NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CategoryDish_pkey" PRIMARY KEY ("categoryId","dishId")
);

-- CreateTable
CREATE TABLE "CompanyCategoryVisibility" (
    "companyId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CompanyCategoryVisibility_pkey" PRIMARY KEY ("companyId","categoryId")
);

-- CreateTable
CREATE TABLE "CompanyDishVisibility" (
    "companyId" UUID NOT NULL,
    "dishId" UUID NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CompanyDishVisibility_pkey" PRIMARY KEY ("companyId","dishId")
);

-- CreateTable
CREATE TABLE "PricingTier" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "derivationType" "PricingDerivationType" NOT NULL DEFAULT 'NONE',
    "derivationSourceTierId" UUID,
    "derivationFactor" DECIMAL(8,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishPrice" (
    "id" UUID NOT NULL,
    "dishId" UUID NOT NULL,
    "pricingTierId" UUID NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "DishPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionPrice" (
    "id" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "pricingTierId" UUID NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "OptionPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "employeeId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "deliveryTime" TEXT NOT NULL,
    "deliveryAddressId" UUID,
    "deliveryAddressSnapshot" JSONB NOT NULL,
    "packaging" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "placedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "kitchenStartedAt" TIMESTAMP(3),
    "kitchenReadyAt" TIMESTAMP(3),
    "plannedDispatchReadyAt" TIMESTAMP(3),
    "plannedKitchenReadyAt" TIMESTAMP(3),
    "kitchenForceCompletedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "dropId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "dishId" UUID,
    "dishNameSnapshot" TEXT NOT NULL,
    "dishSkuSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "lineTotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderCombination" (
    "id" UUID NOT NULL,
    "orderLineId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "portionSizeId" UUID,
    "portionSizeNameSnapshot" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "OrderCombination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderCombinationOption" (
    "id" UUID NOT NULL,
    "combinationId" UUID NOT NULL,
    "optionId" UUID,
    "optionNameSnapshot" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "OrderCombinationOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenPrepUnit" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderCombinationId" UUID NOT NULL,
    "stationId" UUID NOT NULL,
    "status" "KitchenPrepStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "KitchenPrepUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drop" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "addressId" UUID NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "deliveryTime" TEXT NOT NULL,
    "driverId" UUID,
    "status" "DropStatus" NOT NULL DEFAULT 'KITCHEN_READY',
    "outForDeliveryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "deliveredOnTime" BOOLEAN,
    "deliveryNote" TEXT,
    "deliveryPhotoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Drop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "companyId" UUID NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "adjustmentTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceOrder" (
    "invoiceId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "InvoiceOrder_pkey" PRIMARY KEY ("invoiceId","orderId")
);

-- CreateTable
CREATE TABLE "InvoiceAdjustment" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "cutoffTime" TEXT NOT NULL,
    "cutoffWorkingDays" INTEGER NOT NULL,
    "mondayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tuesdayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "wednesdayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "thursdayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fridayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "saturdayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sundayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenHoliday" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "KitchenHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyHoliday" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CompanyHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishAllergen" (
    "dishId" UUID NOT NULL,
    "allergenId" UUID NOT NULL,

    CONSTRAINT "DishAllergen_pkey" PRIMARY KEY ("dishId","allergenId")
);

-- CreateTable
CREATE TABLE "DishDietaryTag" (
    "dishId" UUID NOT NULL,
    "dietaryTagId" UUID NOT NULL,

    CONSTRAINT "DishDietaryTag_pkey" PRIMARY KEY ("dishId","dietaryTagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE INDEX "Company_priceTierId_idx" ON "Company"("priceTierId");

-- CreateIndex
CREATE INDEX "Company_defaultDriverId_idx" ON "Company"("defaultDriverId");

-- CreateIndex
CREATE INDEX "Company_ownerEmployeeId_idx" ON "Company"("ownerEmployeeId");

-- CreateIndex
CREATE INDEX "CompanyEmailDomain_domain_idx" ON "CompanyEmailDomain"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyEmailDomain_companyId_domain_key" ON "CompanyEmailDomain"("companyId", "domain");

-- CreateIndex
CREATE INDEX "CompanyAddress_companyId_idx" ON "CompanyAddress"("companyId");

-- CreateIndex
CREATE INDEX "Employee_companyId_idx" ON "Employee"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_email_key" ON "Employee"("companyId", "email");

-- CreateIndex
CREATE INDEX "EmployeeAllergy_allergenId_idx" ON "EmployeeAllergy"("allergenId");

-- CreateIndex
CREATE INDEX "EmployeeDietaryPreference_dietaryTagId_idx" ON "EmployeeDietaryPreference"("dietaryTagId");

-- CreateIndex
CREATE UNIQUE INDEX "Dish_sku_key" ON "Dish"("sku");

-- CreateIndex
CREATE INDEX "Dish_active_idx" ON "Dish"("active");

-- CreateIndex
CREATE INDEX "Dish_stationId_idx" ON "Dish"("stationId");

-- CreateIndex
CREATE UNIQUE INDEX "Allergen_name_key" ON "Allergen"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DietaryTag_name_key" ON "DietaryTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Station_name_key" ON "Station"("name");

-- CreateIndex
CREATE INDEX "OptionAllergen_allergenId_idx" ON "OptionAllergen"("allergenId");

-- CreateIndex
CREATE INDEX "OptionDietaryTag_dietaryTagId_idx" ON "OptionDietaryTag"("dietaryTagId");

-- CreateIndex
CREATE UNIQUE INDEX "OptionGroup_dishId_name_key" ON "OptionGroup"("dishId", "name");

-- CreateIndex
CREATE INDEX "OptionGroupOption_optionId_idx" ON "OptionGroupOption"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "PortionSize_name_key" ON "PortionSize"("name");

-- CreateIndex
CREATE INDEX "OptionGroupSize_portionSizeId_idx" ON "OptionGroupSize"("portionSizeId");

-- CreateIndex
CREATE INDEX "OptionGroupOptionSize_portionSizeId_idx" ON "OptionGroupOptionSize"("portionSizeId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "CategoryDish_dishId_idx" ON "CategoryDish"("dishId");

-- CreateIndex
CREATE INDEX "CompanyCategoryVisibility_categoryId_idx" ON "CompanyCategoryVisibility"("categoryId");

-- CreateIndex
CREATE INDEX "CompanyDishVisibility_dishId_idx" ON "CompanyDishVisibility"("dishId");

-- CreateIndex
CREATE UNIQUE INDEX "PricingTier_name_key" ON "PricingTier"("name");

-- CreateIndex
CREATE INDEX "PricingTier_derivationSourceTierId_idx" ON "PricingTier"("derivationSourceTierId");

-- CreateIndex
CREATE INDEX "DishPrice_pricingTierId_idx" ON "DishPrice"("pricingTierId");

-- CreateIndex
CREATE UNIQUE INDEX "DishPrice_dishId_pricingTierId_key" ON "DishPrice"("dishId", "pricingTierId");

-- CreateIndex
CREATE INDEX "OptionPrice_pricingTierId_idx" ON "OptionPrice"("pricingTierId");

-- CreateIndex
CREATE UNIQUE INDEX "OptionPrice_optionId_pricingTierId_key" ON "OptionPrice"("optionId", "pricingTierId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_companyId_deliveryDate_idx" ON "Order"("companyId", "deliveryDate");

-- CreateIndex
CREATE INDEX "Order_status_deliveryDate_idx" ON "Order"("status", "deliveryDate");

-- CreateIndex
CREATE INDEX "Order_employeeId_idx" ON "Order"("employeeId");

-- CreateIndex
CREATE INDEX "Order_dropId_idx" ON "Order"("dropId");

-- CreateIndex
CREATE INDEX "Order_deliveryAddressId_idx" ON "Order"("deliveryAddressId");

-- CreateIndex
CREATE INDEX "OrderLine_orderId_idx" ON "OrderLine"("orderId");

-- CreateIndex
CREATE INDEX "OrderLine_dishId_idx" ON "OrderLine"("dishId");

-- CreateIndex
CREATE INDEX "OrderCombination_orderLineId_idx" ON "OrderCombination"("orderLineId");

-- CreateIndex
CREATE INDEX "OrderCombination_portionSizeId_idx" ON "OrderCombination"("portionSizeId");

-- CreateIndex
CREATE INDEX "OrderCombinationOption_combinationId_idx" ON "OrderCombinationOption"("combinationId");

-- CreateIndex
CREATE INDEX "OrderCombinationOption_optionId_idx" ON "OrderCombinationOption"("optionId");

-- CreateIndex
CREATE INDEX "KitchenPrepUnit_orderId_idx" ON "KitchenPrepUnit"("orderId");

-- CreateIndex
CREATE INDEX "KitchenPrepUnit_stationId_status_idx" ON "KitchenPrepUnit"("stationId", "status");

-- CreateIndex
CREATE INDEX "KitchenPrepUnit_orderCombinationId_idx" ON "KitchenPrepUnit"("orderCombinationId");

-- CreateIndex
CREATE INDEX "Drop_companyId_deliveryDate_deliveryTime_idx" ON "Drop"("companyId", "deliveryDate", "deliveryTime");

-- CreateIndex
CREATE INDEX "Drop_addressId_idx" ON "Drop"("addressId");

-- CreateIndex
CREATE INDEX "Drop_driverId_idx" ON "Drop"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "Drop_companyId_addressId_deliveryDate_deliveryTime_key" ON "Drop"("companyId", "addressId", "deliveryDate", "deliveryTime");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_companyId_status_idx" ON "Invoice"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceOrder_orderId_key" ON "InvoiceOrder"("orderId");

-- CreateIndex
CREATE INDEX "InvoiceAdjustment_invoiceId_idx" ON "InvoiceAdjustment"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceAdjustment_orderId_idx" ON "InvoiceAdjustment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenHoliday_date_key" ON "KitchenHoliday"("date");

-- CreateIndex
CREATE INDEX "CompanyHoliday_companyId_idx" ON "CompanyHoliday"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyHoliday_companyId_date_key" ON "CompanyHoliday"("companyId", "date");

-- CreateIndex
CREATE INDEX "DishAllergen_allergenId_idx" ON "DishAllergen"("allergenId");

-- CreateIndex
CREATE INDEX "DishDietaryTag_dietaryTagId_idx" ON "DishDietaryTag"("dietaryTagId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_priceTierId_fkey" FOREIGN KEY ("priceTierId") REFERENCES "PricingTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_defaultDriverId_fkey" FOREIGN KEY ("defaultDriverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerEmployeeId_fkey" FOREIGN KEY ("ownerEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyEmailDomain" ADD CONSTRAINT "CompanyEmailDomain_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAddress" ADD CONSTRAINT "CompanyAddress_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAllergy" ADD CONSTRAINT "EmployeeAllergy_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAllergy" ADD CONSTRAINT "EmployeeAllergy_allergenId_fkey" FOREIGN KEY ("allergenId") REFERENCES "Allergen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDietaryPreference" ADD CONSTRAINT "EmployeeDietaryPreference_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDietaryPreference" ADD CONSTRAINT "EmployeeDietaryPreference_dietaryTagId_fkey" FOREIGN KEY ("dietaryTagId") REFERENCES "DietaryTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionAllergen" ADD CONSTRAINT "OptionAllergen_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionAllergen" ADD CONSTRAINT "OptionAllergen_allergenId_fkey" FOREIGN KEY ("allergenId") REFERENCES "Allergen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionDietaryTag" ADD CONSTRAINT "OptionDietaryTag_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionDietaryTag" ADD CONSTRAINT "OptionDietaryTag_dietaryTagId_fkey" FOREIGN KEY ("dietaryTagId") REFERENCES "DietaryTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionGroup" ADD CONSTRAINT "OptionGroup_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionGroupOption" ADD CONSTRAINT "OptionGroupOption_optionGroupId_fkey" FOREIGN KEY ("optionGroupId") REFERENCES "OptionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionGroupOption" ADD CONSTRAINT "OptionGroupOption_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionGroupSize" ADD CONSTRAINT "OptionGroupSize_optionGroupId_fkey" FOREIGN KEY ("optionGroupId") REFERENCES "OptionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionGroupSize" ADD CONSTRAINT "OptionGroupSize_portionSizeId_fkey" FOREIGN KEY ("portionSizeId") REFERENCES "PortionSize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionGroupOptionSize" ADD CONSTRAINT "OptionGroupOptionSize_optionGroupId_optionId_fkey" FOREIGN KEY ("optionGroupId", "optionId") REFERENCES "OptionGroupOption"("optionGroupId", "optionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionGroupOptionSize" ADD CONSTRAINT "OptionGroupOptionSize_optionGroupId_portionSizeId_fkey" FOREIGN KEY ("optionGroupId", "portionSizeId") REFERENCES "OptionGroupSize"("optionGroupId", "portionSizeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionGroupOptionSize" ADD CONSTRAINT "OptionGroupOptionSize_portionSizeId_fkey" FOREIGN KEY ("portionSizeId") REFERENCES "PortionSize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionGroupOptionSize" ADD CONSTRAINT "OptionGroupOptionSize_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryDish" ADD CONSTRAINT "CategoryDish_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryDish" ADD CONSTRAINT "CategoryDish_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCategoryVisibility" ADD CONSTRAINT "CompanyCategoryVisibility_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCategoryVisibility" ADD CONSTRAINT "CompanyCategoryVisibility_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDishVisibility" ADD CONSTRAINT "CompanyDishVisibility_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDishVisibility" ADD CONSTRAINT "CompanyDishVisibility_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingTier" ADD CONSTRAINT "PricingTier_derivationSourceTierId_fkey" FOREIGN KEY ("derivationSourceTierId") REFERENCES "PricingTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishPrice" ADD CONSTRAINT "DishPrice_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishPrice" ADD CONSTRAINT "DishPrice_pricingTierId_fkey" FOREIGN KEY ("pricingTierId") REFERENCES "PricingTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionPrice" ADD CONSTRAINT "OptionPrice_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionPrice" ADD CONSTRAINT "OptionPrice_pricingTierId_fkey" FOREIGN KEY ("pricingTierId") REFERENCES "PricingTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryAddressId_fkey" FOREIGN KEY ("deliveryAddressId") REFERENCES "CompanyAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_dropId_fkey" FOREIGN KEY ("dropId") REFERENCES "Drop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCombination" ADD CONSTRAINT "OrderCombination_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCombination" ADD CONSTRAINT "OrderCombination_portionSizeId_fkey" FOREIGN KEY ("portionSizeId") REFERENCES "PortionSize"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCombinationOption" ADD CONSTRAINT "OrderCombinationOption_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "OrderCombination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCombinationOption" ADD CONSTRAINT "OrderCombinationOption_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenPrepUnit" ADD CONSTRAINT "KitchenPrepUnit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenPrepUnit" ADD CONSTRAINT "KitchenPrepUnit_orderCombinationId_fkey" FOREIGN KEY ("orderCombinationId") REFERENCES "OrderCombination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenPrepUnit" ADD CONSTRAINT "KitchenPrepUnit_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drop" ADD CONSTRAINT "Drop_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drop" ADD CONSTRAINT "Drop_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "CompanyAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drop" ADD CONSTRAINT "Drop_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceOrder" ADD CONSTRAINT "InvoiceOrder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceOrder" ADD CONSTRAINT "InvoiceOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAdjustment" ADD CONSTRAINT "InvoiceAdjustment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAdjustment" ADD CONSTRAINT "InvoiceAdjustment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyHoliday" ADD CONSTRAINT "CompanyHoliday_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishAllergen" ADD CONSTRAINT "DishAllergen_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishAllergen" ADD CONSTRAINT "DishAllergen_allergenId_fkey" FOREIGN KEY ("allergenId") REFERENCES "Allergen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishDietaryTag" ADD CONSTRAINT "DishDietaryTag_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishDietaryTag" ADD CONSTRAINT "DishDietaryTag_dietaryTagId_fkey" FOREIGN KEY ("dietaryTagId") REFERENCES "DietaryTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

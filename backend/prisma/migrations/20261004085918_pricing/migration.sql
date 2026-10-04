-- CreateEnum
CREATE TYPE "PricingPriceSource" AS ENUM ('MANUAL', 'DERIVED', 'OVERRIDE');

-- AlterTable
ALTER TABLE "DishPrice" ADD COLUMN     "source" "PricingPriceSource" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "OptionPrice" ADD COLUMN     "source" "PricingPriceSource" NOT NULL DEFAULT 'MANUAL';

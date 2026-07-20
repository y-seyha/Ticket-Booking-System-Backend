ALTER TABLE "FoodCategory" DROP CONSTRAINT "FoodCategory_theaterId_fkey";

DROP INDEX IF EXISTS "FoodCategory_theaterId_idx";

ALTER TABLE "FoodCategory" DROP COLUMN "theaterId";

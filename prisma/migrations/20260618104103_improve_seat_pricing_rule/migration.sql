/*
  Warnings:

  - You are about to drop the column `basePrice` on the `ScreenTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `multiplier` on the `SeatPricingRule` table. All the data in the column will be lost.
  - You are about to drop the column `screenId` on the `SeatPricingRule` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[seatType]` on the table `SeatPricingRule` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `SeatPricingRule` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SeatPricingRule" DROP CONSTRAINT "SeatPricingRule_screenId_fkey";

-- DropIndex
DROP INDEX "SeatPricingRule_screenId_idx";

-- DropIndex
DROP INDEX "SeatPricingRule_screenId_seatType_key";

-- AlterTable
ALTER TABLE "ScreenTemplate" DROP COLUMN "basePrice",
ADD COLUMN     "screenSurcharge" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SeatPricingRule" DROP COLUMN "multiplier",
DROP COLUMN "screenId",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "seatSurcharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SeatPricingRule_seatType_key" ON "SeatPricingRule"("seatType");

/*
  Warnings:

  - You are about to drop the column `price` on the `Showtime` table. All the data in the column will be lost.
  - Added the required column `basePrice` to the `Showtime` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Showtime" DROP COLUMN "price",
ADD COLUMN     "basePrice" DECIMAL(10,2) NOT NULL;

-- CreateTable
CREATE TABLE "ScreenPricingRule" (
    "id" TEXT NOT NULL,
    "screenId" TEXT,
    "screenType" "ScreenType" NOT NULL,
    "multiplier" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ScreenPricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatPricingRule" (
    "id" TEXT NOT NULL,
    "screenId" TEXT,
    "seatType" "SeatType" NOT NULL,
    "multiplier" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SeatPricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScreenPricingRule_screenId_idx" ON "ScreenPricingRule"("screenId");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenPricingRule_screenId_screenType_key" ON "ScreenPricingRule"("screenId", "screenType");

-- CreateIndex
CREATE INDEX "SeatPricingRule_screenId_idx" ON "SeatPricingRule"("screenId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatPricingRule_screenId_seatType_key" ON "SeatPricingRule"("screenId", "seatType");

-- AddForeignKey
ALTER TABLE "ScreenPricingRule" ADD CONSTRAINT "ScreenPricingRule_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatPricingRule" ADD CONSTRAINT "SeatPricingRule_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

/*
  Warnings:

  - The values [NORMAL] on the enum `SeatType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `seatRows` on the `ScreenTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `seatsPerRow` on the `ScreenTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Seat` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Seat` table. All the data in the column will be lost.
  - Added the required column `posX` to the `Seat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `posY` to the `Seat` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SeatType_new" AS ENUM ('STANDARD', 'VIP', 'COUPLE', 'WHEELCHAIR');
ALTER TABLE "Seat" ALTER COLUMN "seatType" TYPE "SeatType_new" USING ("seatType"::text::"SeatType_new");
ALTER TYPE "SeatType" RENAME TO "SeatType_old";
ALTER TYPE "SeatType_new" RENAME TO "SeatType";
DROP TYPE "public"."SeatType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Seat" DROP CONSTRAINT "Seat_screenId_fkey";

-- AlterTable
ALTER TABLE "ScreenTemplate" DROP COLUMN "seatRows",
DROP COLUMN "seatsPerRow";

-- AlterTable
ALTER TABLE "Seat" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "posX" INTEGER NOT NULL,
ADD COLUMN     "posY" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

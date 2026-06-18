/*
  Warnings:

  - Added the required column `basePrice` to the `ScreenTemplate` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ScreenTemplate" ADD COLUMN     "basePrice" DECIMAL(10,2) NOT NULL;

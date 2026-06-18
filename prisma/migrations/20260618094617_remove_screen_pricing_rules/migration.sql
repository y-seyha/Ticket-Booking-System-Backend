/*
  Warnings:

  - You are about to drop the `ScreenPricingRule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ScreenTemplatePricingRule` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ScreenPricingRule" DROP CONSTRAINT "ScreenPricingRule_screenId_fkey";

-- DropForeignKey
ALTER TABLE "ScreenTemplatePricingRule" DROP CONSTRAINT "ScreenTemplatePricingRule_templateId_fkey";

-- DropTable
DROP TABLE "ScreenPricingRule";

-- DropTable
DROP TABLE "ScreenTemplatePricingRule";

-- AlterEnum
ALTER TYPE "ScreenType" ADD VALUE 'THREE_D';

-- CreateTable
CREATE TABLE "ScreenTemplatePricingRule" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "screenType" "ScreenType" NOT NULL,
    "multiplier" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ScreenTemplatePricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScreenTemplatePricingRule_templateId_idx" ON "ScreenTemplatePricingRule"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenTemplatePricingRule_templateId_screenType_key" ON "ScreenTemplatePricingRule"("templateId", "screenType");

-- AddForeignKey
ALTER TABLE "ScreenTemplatePricingRule" ADD CONSTRAINT "ScreenTemplatePricingRule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ScreenTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

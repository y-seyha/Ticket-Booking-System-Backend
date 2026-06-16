/*
  Warnings:

  - Added the required column `templateId` to the `Screen` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Screen" ADD COLUMN     "templateId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "ScreenTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ScreenType" NOT NULL,
    "seatRows" INTEGER NOT NULL,
    "seatsPerRow" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenTemplate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Screen" ADD CONSTRAINT "Screen_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ScreenTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

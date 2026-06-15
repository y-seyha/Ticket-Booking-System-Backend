/*
  Warnings:

  - A unique constraint covering the columns `[imageId]` on the table `Theater` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Theater" ADD COLUMN     "imageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Theater_imageId_key" ON "Theater"("imageId");

-- AddForeignKey
ALTER TABLE "Theater" ADD CONSTRAINT "Theater_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

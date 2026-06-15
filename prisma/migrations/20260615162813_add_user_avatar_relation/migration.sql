/*
  Warnings:

  - You are about to drop the column `avatarUrl` on the `UserProfile` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[avatarId]` on the table `UserProfile` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "UserProfile" DROP COLUMN "avatarUrl",
ADD COLUMN     "avatarId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_avatarId_key" ON "UserProfile"("avatarId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

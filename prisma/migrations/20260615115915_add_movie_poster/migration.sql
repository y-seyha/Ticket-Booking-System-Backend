/*
  Warnings:

  - You are about to drop the column `posterUrl` on the `Movie` table. All the data in the column will be lost.
  - You are about to drop the column `trailerUrl` on the `Movie` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[posterId]` on the table `Movie` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Movie" DROP COLUMN "posterUrl",
DROP COLUMN "trailerUrl",
ADD COLUMN     "posterId" TEXT,
ADD COLUMN     "trailerYoutubeId" TEXT;

-- AlterTable
ALTER TABLE "Theater" ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Movie_posterId_key" ON "Movie"("posterId");

-- AddForeignKey
ALTER TABLE "Movie" ADD CONSTRAINT "Movie_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FoodCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "theaterId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FoodCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FoodItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "imageId" TEXT,
    "categoryId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FoodItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FoodCategory_theaterId_idx" ON "FoodCategory"("theaterId");

CREATE UNIQUE INDEX "FoodItem_imageId_key" ON "FoodItem"("imageId");

CREATE INDEX "FoodItem_categoryId_idx" ON "FoodItem"("categoryId");

ALTER TABLE "FoodCategory" ADD CONSTRAINT "FoodCategory_theaterId_fkey" FOREIGN KEY ("theaterId") REFERENCES "Theater"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FoodItem" ADD CONSTRAINT "FoodItem_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FoodItem" ADD CONSTRAINT "FoodItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FoodCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

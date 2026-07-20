CREATE TABLE "BookingFoodItem" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "foodItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingFoodItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingFoodItem_bookingId_idx" ON "BookingFoodItem"("bookingId");

CREATE INDEX "BookingFoodItem_foodItemId_idx" ON "BookingFoodItem"("foodItemId");

ALTER TABLE "BookingFoodItem" ADD CONSTRAINT "BookingFoodItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookingFoodItem" ADD CONSTRAINT "BookingFoodItem_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

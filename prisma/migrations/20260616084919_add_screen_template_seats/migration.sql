-- CreateTable
CREATE TABLE "ScreenTemplateSeat" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "seatRow" TEXT NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "posX" INTEGER NOT NULL,
    "posY" INTEGER NOT NULL,
    "seatType" "SeatType" NOT NULL,

    CONSTRAINT "ScreenTemplateSeat_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ScreenTemplateSeat" ADD CONSTRAINT "ScreenTemplateSeat_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ScreenTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

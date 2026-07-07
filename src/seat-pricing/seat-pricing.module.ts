import { Module } from '@nestjs/common';
import { SeatPricingController } from './seat-pricing.controller';
import { SeatPricingService } from './seat-pricing.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SeatPricingController],
  providers: [SeatPricingService, PrismaService],
})
export class SeatPricingModule {}

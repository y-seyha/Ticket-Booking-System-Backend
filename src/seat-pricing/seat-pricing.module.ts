import { Module } from '@nestjs/common';
import { SeatPricingController } from './seat-pricing.controller';
import { SeatPricingService } from './seat-pricing.service';

@Module({
  controllers: [SeatPricingController],
  providers: [SeatPricingService],
})
export class SeatPricingModule {}

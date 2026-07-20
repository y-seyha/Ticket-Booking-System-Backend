import { Module } from '@nestjs/common';
import { SeatController } from './seat.controller';
import { SeatService } from './seat.service';
import { SeatGateway } from './seat.gateway';

@Module({
  controllers: [SeatController],
  providers: [SeatService, SeatGateway],
  exports: [SeatGateway],
})
export class SeatModule {}

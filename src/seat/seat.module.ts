import { Module } from '@nestjs/common';
import { SeatController } from './seat.controller';
import { SeatService } from './seat.service';
import { SeatGateway } from './seat.gateway';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SeatController],
  providers: [SeatService, SeatGateway, PrismaService],
  exports: [SeatGateway],
})
export class SeatModule {}

import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { SeatModule } from '../seat/seat.module';
import { TicketModule } from '../ticket/ticket.module';

@Module({
  imports: [SeatModule, TicketModule],
  controllers: [PaymentController],
  providers: [PaymentService, PrismaService],
})
export class PaymentModule {}

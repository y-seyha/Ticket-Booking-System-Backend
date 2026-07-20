import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { SeatModule } from '../seat/seat.module';
import { TicketModule } from '../ticket/ticket.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [SeatModule, TicketModule, NotificationModule],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}

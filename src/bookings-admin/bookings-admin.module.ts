import { Module } from '@nestjs/common';
import { BookingsAdminController } from './bookings-admin.controller';
import { BookingsAdminService } from './bookings-admin.service';
import { SeatModule } from '../seat/seat.module';

@Module({
  imports: [SeatModule],
  controllers: [BookingsAdminController],
  providers: [BookingsAdminService],
  exports: [BookingsAdminService],
})
export class BookingsAdminModule {}

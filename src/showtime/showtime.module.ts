import { Module } from '@nestjs/common';
import { ShowtimeService } from './showtime.service';
import { ShowtimeController } from './showtime.controller';

@Module({
  providers: [ShowtimeService],
  controllers: [ShowtimeController],
})
export class ShowtimeModule {}

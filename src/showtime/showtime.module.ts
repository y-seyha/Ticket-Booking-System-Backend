import { Module } from '@nestjs/common';
import { ShowtimeService } from './showtime.service';
import { ShowtimeController } from './showtime.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [ShowtimeService, PrismaService],
  controllers: [ShowtimeController],
})
export class ShowtimeModule {}

import { Module } from '@nestjs/common';
import { ScreenService } from './screen.service';
import { ScreenController } from './screen.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ScreenController],
  providers: [ScreenService, PrismaService],
})
export class ScreenModule {}

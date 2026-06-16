import { Module } from '@nestjs/common';
import { SeatTemplateController } from './seat-template.controller';
import { SeatTemplateService } from './seat-template.service';
import {PrismaService} from "../prisma/prisma.service";

@Module({
  controllers: [SeatTemplateController],
  providers: [SeatTemplateService,PrismaService],
  exports: [SeatTemplateService],
})
export class SeatTemplateModule {}

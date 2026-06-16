import { Module } from '@nestjs/common';
import { ScreenTemplateController } from './screen-template.controller';
import { ScreenTemplateService } from './screen-template.service';
import {PrismaService} from "../prisma/prisma.service";

@Module({
  controllers: [ScreenTemplateController],
  providers: [ScreenTemplateService, PrismaService],
  exports: [ScreenTemplateService]
})
export class ScreenTemplateModule {}

import { Module } from '@nestjs/common';
import { ScreenTemplateController } from './screen-template.controller';
import { ScreenTemplateService } from './screen-template.service';

@Module({
  controllers: [ScreenTemplateController],
  providers: [ScreenTemplateService],
  exports: [ScreenTemplateService],
})
export class ScreenTemplateModule {}

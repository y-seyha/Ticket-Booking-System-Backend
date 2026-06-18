import { PartialType } from '@nestjs/mapped-types';
import { CreateScreenTemplateDto } from './create-screen-template.dto';

export class UpdateScreenTemplateDto extends PartialType(
  CreateScreenTemplateDto,
) {}

import { ApiProperty, PartialType, OmitType } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { GenerateTemplateSeatsDto } from './generate-template-seat.dto';

export class UpdateTemplateLayoutDto extends PartialType(
  OmitType(GenerateTemplateSeatsDto, ['templateId'] as const),
) {
  @ApiProperty({ example: 'VIP Weekend Layout', required: false })
  @IsString()
  @IsOptional()
  name?: string;
}

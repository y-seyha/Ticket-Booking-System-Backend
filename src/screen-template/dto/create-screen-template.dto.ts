import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScreenType } from '@prisma/client';

export class CreateScreenTemplateDto {
  @ApiProperty({
    example: 'IMAX Large Layout',
  })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({
    enum: ScreenType,
  })
  @IsEnum(ScreenType)
  type: ScreenType;

  @ApiPropertyOptional({
    example: 'Best layout for IMAX cinema',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 12.5,
    description: 'Base price for this screen template',
  })
  @IsNumber()
  screenSurcharge: number;
}

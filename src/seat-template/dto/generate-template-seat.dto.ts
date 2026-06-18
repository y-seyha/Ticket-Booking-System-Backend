import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  Min,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SeatType } from '@prisma/client';

class SeatRowConfig {
  @ApiProperty({ example: 'A' })
  @IsString()
  row: string;

  @ApiProperty({ enum: SeatType })
  @IsEnum(SeatType)
  seatType: SeatType;
}

export class GenerateTemplateSeatsDto {
  @ApiProperty({ example: 'template-id' })
  @IsString()
  templateId: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(1)
  rows: number;

  @ApiProperty({ example: 12 })
  @IsNumber()
  @Min(1)
  seatsPerRow: number;

  @ApiProperty({ type: [SeatRowConfig] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeatRowConfig)
  seatMap: SeatRowConfig[];
}

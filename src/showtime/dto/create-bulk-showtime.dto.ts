import {
  IsString,
  IsArray,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  ArrayNotEmpty,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateBulkScheduleDto {
  @ApiProperty({
    example: 'clxxxxxxxxxxxxxxx',
    description: 'The distinct ID of the movie being scheduled',
  })
  @IsString()
  @IsNotEmpty()
  movieId: string;

  @ApiProperty({
    example: ['screen-id-1', 'screen-id-2'],
    description: 'An array of Screen IDs across different halls or branches',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  screenIds: string[];

  @ApiProperty({
    example: ['2026-07-11', '2026-07-12'],
    description:
      'Target calendar days to apply the slot configuration grid matrix',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    each: true,
    message: 'Each target date must match YYYY-MM-DD',
  })
  targetDates: string[];

  @ApiProperty({
    example: ['10:00', '13:15', '16:30', '19:45', '23:00'],
    description: 'Daily localized starting time slot tracks',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    each: true,
    message: 'Each daily slot must be in HH:MM 24-hour format',
  })
  dailySlots: string[];

  @ApiProperty({
    example: 6.5,
    description: 'Standard baseline seat ticket fee currency units',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiPropertyOptional({
    example: 15,
    description:
      'Turnaround buffer window segment allowance in minutes between consecutive slots',
    default: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cleaningBufferMinutes?: number;
}

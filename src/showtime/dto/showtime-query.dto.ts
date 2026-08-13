import {
  IsOptional,
  IsInt,
  Min,
  IsString,
  IsEnum,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShowtimeStatus } from '@prisma/client';

export class ShowtimeQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 'mission' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  movieId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  screenId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  theaterId?: string;

  @ApiPropertyOptional({ enum: ShowtimeStatus })
  @IsOptional()
  @IsEnum(ShowtimeStatus)
  status?: ShowtimeStatus;

  @ApiPropertyOptional({ example: '2026-08-13' })
  @IsOptional()
  @IsDateString()
  date?: string;
}

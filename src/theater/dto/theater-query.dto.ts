import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TheaterStatus } from '@prisma/client';

export class TheaterQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 'Legend' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: TheaterStatus })
  @IsOptional()
  @IsEnum(TheaterStatus)
  status?: TheaterStatus;
}

import {
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AnalyticsEventSource } from '@prisma/client';

export enum GroupBy {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export enum ReportType {
  REVENUE = 'revenue',
  BOOKINGS = 'bookings',
  USERS = 'users',
  MOVIES = 'movies',
  FOOD_BEVERAGE = 'food_beverage',
  OCCUPANCY = 'occupancy',
}

export class DateRangeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: GroupBy })
  @IsOptional()
  @IsEnum(GroupBy)
  groupBy?: GroupBy;
}

export class PaginationDto {
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
  limit?: number = 20;
}

export class AnalyticsEventQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: AnalyticsEventSource })
  @IsOptional()
  @IsEnum(AnalyticsEventSource)
  source?: AnalyticsEventSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class TrackEventDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @Type(() => Number)
  value?: number;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  pageUrl?: string;
}

export class ExportReportDto {
  @IsEnum(ReportType)
  type: ReportType;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(GroupBy)
  groupBy?: GroupBy;
}

export class Ga4WebhookDto {
  @IsOptional()
  @IsString()
  client_id?: string;

  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  events?: Record<string, unknown>[];
}

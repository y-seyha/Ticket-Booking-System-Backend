import { IsOptional, IsString, IsIn, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class NotificationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by read status' })
  @IsOptional()
  @IsString()
  @IsIn(['read', 'unread'])
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by notification type' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ArrayNotEmpty,
} from 'class-validator';

export class CreateBulkFoodItemDto {
  @ApiProperty({ example: 'Large Popcorn' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Butter-salted large popcorn' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 5.99 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({
    example: ['uuid-of-category-1', 'uuid-of-category-2'],
    description: 'Array of category IDs to add this item to',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  categoryIds: string[];
}

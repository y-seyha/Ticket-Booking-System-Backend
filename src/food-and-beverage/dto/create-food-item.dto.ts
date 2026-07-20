import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateFoodItemDto {
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

  @ApiProperty({ example: 'uuid-of-category' })
  @IsString()
  categoryId: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true, description: 'Item active status' })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Image file ID' })
  @IsOptional()
  @IsString()
  imageId?: string;
}

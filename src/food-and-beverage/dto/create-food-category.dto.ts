import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateFoodCategoryDto {
  @ApiProperty({ example: 'Popcorn' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true, description: 'Category active status' })
  @IsOptional()
  isActive?: boolean;
}

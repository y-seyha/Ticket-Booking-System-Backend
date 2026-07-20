import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class FoodOrderItemEntry {
  @ApiProperty({ example: 'uuid-of-food-item' })
  @IsString()
  foodItemId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateFoodOrderDto {
  @ApiProperty({ type: [FoodOrderItemEntry] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FoodOrderItemEntry)
  items: FoodOrderItemEntry[];
}

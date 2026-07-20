import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class BookingFoodItemEntry {
  @ApiProperty({ example: 'uuid-of-food-item' })
  @IsString()
  foodItemId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class AddBookingFoodItemsDto {
  @ApiProperty({ type: [BookingFoodItemEntry] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingFoodItemEntry)
  items: BookingFoodItemEntry[];
}

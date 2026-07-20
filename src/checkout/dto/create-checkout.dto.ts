import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookingStatus, PaymentProvider, PaymentStatus } from '@prisma/client';

export class FoodItemEntry {
  @ApiProperty({ example: 'uuid-of-food-item' })
  @IsUUID()
  foodItemId: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateCheckoutDto {
  @ApiProperty({
    enum: PaymentProvider,
    required: false,
    example: PaymentProvider.KHQR,
    description:
      'Selected payment method for checkout. Leave optional to select on the next screen.',
  })
  @IsOptional()
  @IsEnum(PaymentProvider)
  paymentProvider?: PaymentProvider;

  @ApiProperty({
    required: false,
    example: 'User notes',
    description: 'Optional note from customer',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    required: false,
    type: [FoodItemEntry],
    description: 'Optional food items to add to the booking',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FoodItemEntry)
  foodItems?: FoodItemEntry[];
}

export class UpdatePaymentMethodDto {
  @ApiProperty({
    enum: PaymentProvider,
    example: PaymentProvider.KHQR,
    description: 'The newly chosen payment provider selected by the user',
  })
  @IsEnum(PaymentProvider)
  paymentProvider: PaymentProvider;
}

export class PayDto {
  @ApiProperty({
    example: 'e6f3e4a2-c1fd-4c64-a46d-bf8f8b8e9c99',
    description: 'Payment ID generated during checkout',
  })
  @IsUUID()
  paymentId: string;
}

export class CheckoutResponseDto {
  @ApiProperty()
  bookingId: string;

  @ApiProperty()
  bookingCode: string;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty({ enum: BookingStatus })
  bookingStatus: BookingStatus;

  @ApiProperty()
  paymentId: string;

  @ApiProperty({ enum: PaymentProvider })
  paymentProvider: PaymentProvider;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus: PaymentStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  paymentExpiresAt: Date | null;

  @ApiProperty({ required: false })
  paymentUrl?: string;

  @ApiProperty({ required: false })
  qrCode?: string;
}

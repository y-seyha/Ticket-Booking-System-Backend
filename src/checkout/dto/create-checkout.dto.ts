import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BookingStatus, PaymentProvider, PaymentStatus } from '@prisma/client';

export class CreateCheckoutDto {
  @ApiProperty({
    enum: PaymentProvider,
    example: PaymentProvider.KHQR,
    description: 'Selected payment method for checkout',
  })
  @IsEnum(PaymentProvider)
  paymentProvider: PaymentProvider;

  @ApiProperty({
    required: false,
    example: 'User notes',
    description: 'Optional note from customer',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CheckoutResponseDto {
  @ApiProperty()
  bookingId: string;

  @ApiProperty()
  bookingCode: string;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty({
    enum: BookingStatus,
  })
  bookingStatus: BookingStatus;

  @ApiProperty()
  paymentId: string;

  @ApiProperty({
    enum: PaymentProvider,
  })
  paymentProvider: PaymentProvider;

  @ApiProperty({
    enum: PaymentStatus,
  })
  paymentStatus: PaymentStatus;

  @ApiProperty({
    required: false,
  })
  paymentUrl?: string;

  @ApiProperty({
    required: false,
  })
  qrCode?: string;
}

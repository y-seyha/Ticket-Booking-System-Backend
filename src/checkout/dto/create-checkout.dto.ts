import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { BookingStatus, PaymentProvider, PaymentStatus } from '@prisma/client';

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
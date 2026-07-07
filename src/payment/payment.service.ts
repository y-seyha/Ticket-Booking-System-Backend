import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { BookingStatus, PaymentProvider, PaymentStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PayDto } from './dto/pay.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async payCash(accountId: string, dto: PayDto) {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: {
          id: dto.paymentId,
        },
        include: {
          booking: true,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.booking.accountId !== accountId) {
        throw new BadRequestException('Payment does not belong to user');
      }

      if (payment.provider !== PaymentProvider.CASH) {
        throw new BadRequestException('Payment is not CASH');
      }

      if (payment.status === PaymentStatus.SUCCESS) {
        throw new BadRequestException('Payment already completed');
      }

      if (payment.status === PaymentStatus.EXPIRED) {
        throw new BadRequestException('Payment has expired');
      }

      if (payment.booking.status === BookingStatus.EXPIRED) {
        throw new BadRequestException('Booking has expired');
      }

      const now = new Date();

      if (payment.expiresAt && payment.expiresAt < now) {
        await this.prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.EXPIRED,
            },
          });

          await tx.booking.update({
            where: {
              id: payment.bookingId,
            },
            data: {
              status: BookingStatus.EXPIRED,
            },
          });

          await tx.bookingSeat.deleteMany({
            where: {
              bookingId: payment.bookingId,
            },
          });
        });

        throw new BadRequestException('Payment session expired');
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const updatedPayment = await tx.payment.update({
          where: {
            id: payment.id,
          },
          data: {
            status: PaymentStatus.SUCCESS,
            paidAt: now,
          },
        });

        const updatedBooking = await tx.booking.update({
          where: {
            id: payment.bookingId,
          },
          data: {
            status: BookingStatus.CONFIRMED,
          },
        });

        return {
          updatedPayment,
          updatedBooking,
        };
      });

      return {
        message: 'Cash payment completed successfully',

        bookingId: result.updatedBooking.id,

        bookingStatus: result.updatedBooking.status,

        paymentId: result.updatedPayment.id,

        paymentStatus: result.updatedPayment.status,

        paidAt: result.updatedPayment.paidAt,
      };
    } catch (error) {
      this.logger.error(error.message, error.stack);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Payment processing failed');
    }
  }
}

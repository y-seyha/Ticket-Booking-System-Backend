import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, PaymentProvider, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PayDto,
  UpdatePaymentMethodDto,
  CheckoutResponseDto,
} from '../checkout/dto/create-checkout.dto';
import { SeatGateway } from '../seat/seat.gateway';
import { TicketService } from '../ticket/ticket.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly seatGateway: SeatGateway,
    private readonly ticketService: TicketService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Allows the customer to alter their payment option dynamically while
   * viewing their active checkout summary screen.
   */
  async changePaymentMethod(
    accountId: string,
    paymentId: string,
    dto: UpdatePaymentMethodDto,
  ): Promise<CheckoutResponseDto> {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: { booking: true },
      });

      if (!payment) {
        throw new NotFoundException('Payment session not found');
      }

      if (payment.booking.accountId !== accountId) {
        throw new BadRequestException('Transaction does not belong to user');
      }

      if (payment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException('Payment configuration is closed');
      }

      const now = new Date();
      if (payment.expiresAt && payment.expiresAt < now) {
        throw new BadRequestException('Payment session expired');
      }

      const updatedPayment = await this.prisma.payment.update({
        where: { id: paymentId },
        data: { provider: dto.paymentProvider },
        include: { booking: true },
      });

      let qrCode: string | undefined;
      let paymentUrl: string | undefined;

      if (dto.paymentProvider === PaymentProvider.KHQR) {
        qrCode = `00020101021252040000...updated-khqr-for-${updatedPayment.booking.bookingCode}`;
      } else if (dto.paymentProvider === PaymentProvider.STRIPE) {
        paymentUrl = `https://checkout.stripe.com/pay/mock_session_${updatedPayment.id}`;
      }

      return {
        bookingId: updatedPayment.bookingId,
        bookingCode: updatedPayment.booking.bookingCode,
        totalAmount: Number(updatedPayment.amount),
        bookingStatus: updatedPayment.booking.status,
        paymentId: updatedPayment.id,
        paymentProvider: updatedPayment.provider,
        paymentStatus: updatedPayment.status,
        paymentExpiresAt: updatedPayment.expiresAt,
        qrCode,
        paymentUrl,
      };
    } catch (error) {
      this.logger.error(error.message, error.stack);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update payment method');
    }
  }

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

        const bookingSeats = await tx.bookingSeat.findMany({
          where: { bookingId: payment.bookingId },
        });

        return {
          updatedPayment,
          updatedBooking,
          bookingSeats,
        };
      });

      if (payment.booking.showtimeId) {
        this.seatGateway.emitSeatsBooked(
          payment.booking.showtimeId,
          result.bookingSeats.map((bs) => bs.seatId),
        );
      }

      await this.ticketService.generateTicketsForBooking(payment.bookingId);

      await this.notificationService.sendBookingConfirmation(
        accountId,
        payment.bookingId,
      );

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

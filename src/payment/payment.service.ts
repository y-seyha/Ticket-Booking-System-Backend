import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PayDto,
  UpdatePaymentMethodDto,
  CheckoutResponseDto,
} from '../checkout/dto/create-checkout.dto';
import { SeatGateway } from '../seat/seat.gateway';
import { TicketService } from '../ticket/ticket.service';
import { NotificationService } from '../notification/notification.service';
import { AdminPaymentsQueryDto, AdminPaymentExportDto } from './dto/admin-payments-query.dto';

const adminFindAllInclude = {
  booking: {
    include: {
      account: { include: { profile: true } },
      showtime: { include: { movie: true } },
    },
  },
} satisfies Prisma.PaymentInclude;

const adminFindOneInclude = {
  booking: {
    include: {
      account: { include: { profile: true } },
      showtime: {
        include: {
          movie: true,
          screen: { include: { theater: true } },
        },
      },
      bookingSeats: {
        include: { seat: true, ticket: true },
      },
      foodItems: { include: { foodItem: true } },
      tickets: true,
    },
  },
} satisfies Prisma.PaymentInclude;

const adminExportInclude = {
  booking: {
    include: {
      account: { include: { profile: true } },
    },
  },
} satisfies Prisma.PaymentInclude;

const adminFindAllArgs = { include: adminFindAllInclude };
const adminFindOneArgs = { include: adminFindOneInclude };
const adminExportArgs = { include: adminExportInclude };

type AdminFindAllPayment = Prisma.PaymentGetPayload<typeof adminFindAllArgs>;
type AdminFindOnePayment = Prisma.PaymentGetPayload<typeof adminFindOneArgs>;
type AdminExportPayment = Prisma.PaymentGetPayload<typeof adminExportArgs>;

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

  async adminFindAll(query: AdminPaymentsQueryDto) {
    try {
      const where: Prisma.PaymentWhereInput = {};

      if (query.status) {
        where.status = query.status as PaymentStatus;
      }
      if (query.provider) {
        where.provider = query.provider;
      }
      if (query.from || query.to) {
        where.createdAt = {};
        if (query.from) where.createdAt.gte = new Date(query.from);
        if (query.to) {
          const toEnd = new Date(query.to);
          toEnd.setHours(23, 59, 59, 999);
          where.createdAt.lte = toEnd;
        }
      }

      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.prisma.payment.findMany({
          where,
          ...adminFindAllArgs,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.payment.count({ where }),
      ]);

      return {
        data: data.map((p: AdminFindAllPayment) => ({
          id: p.id,
          provider: p.provider,
          amount: Number(p.amount),
          currency: p.currency,
          status: p.status,
          transactionRef: p.transactionRef,
          paidAt: p.paidAt,
          expiresAt: p.expiresAt,
          createdAt: p.createdAt,
          booking: p.booking
            ? {
                id: p.booking.id,
                bookingCode: p.booking.bookingCode,
                totalPrice: Number(p.booking.totalPrice),
                status: p.booking.status,
                account: p.booking.account
                  ? {
                      email: p.booking.account.email,
                      profile: p.booking.account.profile
                        ? {
                            firstName: p.booking.account.profile.firstName,
                            lastName: p.booking.account.profile.lastName,
                          }
                        : null,
                    }
                  : null,
                showtime: p.booking.showtime
                  ? {
                      startTime: p.booking.showtime.startTime,
                      movie: p.booking.showtime.movie
                        ? { title: p.booking.showtime.movie.title }
                        : null,
                    }
                  : null,
              }
            : null,
        })),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch payments: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch payments');
    }
  }

  async adminFindOne(id: string) {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id },
        ...adminFindOneArgs,
      }) as AdminFindOnePayment | null;

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      return {
        id: payment.id,
        provider: payment.provider,
        amount: Number(payment.amount),
        currency: payment.currency,
        status: payment.status,
        transactionRef: payment.transactionRef,
        paidAt: payment.paidAt,
        expiresAt: payment.expiresAt,
        createdAt: payment.createdAt,
        booking: payment.booking
          ? {
              id: payment.booking.id,
              bookingCode: payment.booking.bookingCode,
              totalPrice: Number(payment.booking.totalPrice),
              status: payment.booking.status,
              account: payment.booking.account
                ? {
                    email: payment.booking.account.email,
                    profile: payment.booking.account.profile
                      ? {
                          firstName: payment.booking.account.profile.firstName,
                          lastName: payment.booking.account.profile.lastName,
                          phone: payment.booking.account.profile.phone,
                        }
                      : null,
                  }
                : null,
              showtime: payment.booking.showtime
                ? {
                    startTime: payment.booking.showtime.startTime,
                    endTime: payment.booking.showtime.endTime,
                    basePrice: Number(payment.booking.showtime.basePrice),
                    movie: payment.booking.showtime.movie
                      ? {
                          id: payment.booking.showtime.movie.id,
                          title: payment.booking.showtime.movie.title,
                          language: payment.booking.showtime.movie.language,
                        }
                      : null,
                    screen: payment.booking.showtime.screen
                      ? {
                          id: payment.booking.showtime.screen.id,
                          name: payment.booking.showtime.screen.name,
                          type: payment.booking.showtime.screen.type,
                          theater: payment.booking.showtime.screen.theater
                            ? {
                                id: payment.booking.showtime.screen.theater.id,
                                name: payment.booking.showtime.screen.theater.name,
                              }
                            : null,
                        }
                      : null,
                  }
                : null,
              bookingSeats: payment.booking.bookingSeats?.map((bs) => ({
                id: bs.id,
                price: Number(bs.price),
                seat: bs.seat
                  ? {
                      id: bs.seat.id,
                      seatRow: bs.seat.seatRow,
                      seatNumber: bs.seat.seatNumber,
                      seatType: bs.seat.seatType,
                    }
                  : null,
                ticket: bs.ticket
                  ? {
                      id: bs.ticket.id,
                      qrCode: bs.ticket.qrCode,
                      status: bs.ticket.status,
                    }
                  : null,
              })),
              foodItems: payment.booking.foodItems?.map((fi) => ({
                id: fi.id,
                quantity: fi.quantity,
                unitPrice: Number(fi.unitPrice),
                foodItem: fi.foodItem
                  ? { id: fi.foodItem.id, name: fi.foodItem.name, price: Number(fi.foodItem.price) }
                  : null,
              })),
            }
          : null,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch payment ${id}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch payment');
    }
  }

  async adminExportCsv(query: AdminPaymentExportDto) {
    try {
      const where: Prisma.PaymentWhereInput = {};

      if (query.status) {
        where.status = query.status as PaymentStatus;
      }
      if (query.provider) {
        where.provider = query.provider;
      }
      if (query.from || query.to) {
        where.createdAt = {};
        if (query.from) where.createdAt.gte = new Date(query.from);
        if (query.to) {
          const toEnd = new Date(query.to);
          toEnd.setHours(23, 59, 59, 999);
          where.createdAt.lte = toEnd;
        }
      }

      const payments = await this.prisma.payment.findMany({
        where,
        ...adminExportArgs,
        orderBy: { createdAt: 'desc' },
      });

      const headers = 'Payment ID,Provider,Amount,Currency,Status,Booking Code,User Email,User Name,Paid At,Created At\n';
      const rows = payments.map((p: AdminExportPayment) => {
        const name = [p.booking?.account?.profile?.firstName, p.booking?.account?.profile?.lastName].filter(Boolean).join(' ');
        return `"${p.id}",${p.provider},${Number(p.amount)},${p.currency},${p.status},"${p.booking?.bookingCode || ''}","${p.booking?.account?.email || ''}","${name}",${p.paidAt?.toISOString() || ''},${p.createdAt.toISOString()}`;
      }).join('\n');

      return {
        filename: `payments-export-${query.from || 'all'}-${query.to || 'now'}.csv`,
        csv: headers + rows,
      };
    } catch (error) {
      this.logger.error(`Failed to export payments CSV: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to export payments');
    }
  }
}
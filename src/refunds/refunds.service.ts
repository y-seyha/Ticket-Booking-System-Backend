import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { TicketStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminRefundsQueryDto, AdminRefundsExportDto } from './dto/refunds-query.dto';

const refundInclude = {
  booking: {
    include: {
      account: {
        include: {
          profile: true,
        },
      },
      showtime: {
        include: {
          movie: true,
          screen: {
            include: {
              theater: true,
            },
          },
        },
      },
      payment: true,
    },
  },
  bookingSeat: {
    include: {
      seat: true,
    },
  },
} satisfies Prisma.TicketInclude;

const refundExportInclude = {
  booking: {
    include: {
      account: { include: { profile: true } },
      showtime: { include: { movie: true } },
      payment: true,
    },
  },
  bookingSeat: { include: { seat: true } },
} satisfies Prisma.TicketInclude;

type RefundTicket = Prisma.TicketGetPayload<{ include: typeof refundInclude }>;

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminRefundsQueryDto) {
    try {
      const where: Prisma.TicketWhereInput = {
        status: TicketStatus.REFUNDED,
      };

      if (query.from || query.to) {
        where.updatedAt = {};
        if (query.from) where.updatedAt.gte = new Date(query.from);
        if (query.to) {
          const toEnd = new Date(query.to);
          toEnd.setHours(23, 59, 59, 999);
          where.updatedAt.lte = toEnd;
        }
      }

      if (query.search) {
        const term = query.search;
        where.OR = [
          { booking: { bookingCode: { contains: term, mode: 'insensitive' } } },
          { booking: { account: { email: { contains: term, mode: 'insensitive' } } } },
          { booking: { showtime: { movie: { title: { contains: term, mode: 'insensitive' } } } } },
        ];
      }

      const [data, total] = await Promise.all([
        this.prisma.ticket.findMany({
          where,
          include: refundInclude,
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.ticket.count({ where }),
      ]);

      return {
        data: data.map((ticket: RefundTicket) => this.transformRefund(ticket)),
        meta: { total },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch refunds: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch refunds');
    }
  }

  async afterRefund(ticket: { id: string; bookingSeatId: string }): Promise<RefundTicket | null> {
    try {
      const bookingSeat = await this.prisma.bookingSeat.findUnique({
        where: { id: ticket.bookingSeatId },
        include: {
          booking: {
            include: {
              payment: true,
              tickets: true,
            },
          },
        },
      });

      if (!bookingSeat) {
        this.logger.warn(`Booking seat ${ticket.bookingSeatId} not found for ticket ${ticket.id}`);
        return null;
      }

      const { booking } = bookingSeat;
      const allRefunded = booking.tickets.every(
        (t) => t.status === TicketStatus.REFUNDED,
      );

      if (allRefunded && booking.payment) {
        await this.prisma.payment.update({
          where: { id: booking.payment.id },
          data: { status: PaymentStatus.REFUNDED },
        });
        this.logger.log(`Payment ${booking.payment.id} marked as REFUNDED`);
      }

      const refundedTicket = await this.prisma.ticket.findUnique({
        where: { id: ticket.id },
        include: refundInclude,
      });

      if (!refundedTicket) {
        this.logger.warn(`Ticket ${ticket.id} not found after refund processing`);
        return null;
      }

      return refundedTicket;
    } catch (error) {
      this.logger.error(`Failed to process refund for ticket ${ticket.id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to process ticket refund');
    }
  }

  async exportCsv(query: AdminRefundsExportDto) {
    try {
      const where: Prisma.TicketWhereInput = {
        status: TicketStatus.REFUNDED,
      };

      if (query.from || query.to) {
        where.updatedAt = {};
        if (query.from) where.updatedAt.gte = new Date(query.from);
        if (query.to) {
          const toEnd = new Date(query.to);
          toEnd.setHours(23, 59, 59, 999);
          where.updatedAt.lte = toEnd;
        }
      }

      const refunds = await this.prisma.ticket.findMany({
        where,
        include: refundExportInclude,
        orderBy: { updatedAt: 'desc' },
      });

      const headers = 'Ticket ID,QR Code,Booking Code,User Email,User Name,Movie,Seat,Payment Status,Refunded At\n';
      const rows = refunds.map((r) => {
        const name = [r.booking.account.profile?.firstName, r.booking.account.profile?.lastName].filter(Boolean).join(' ');
        const movie = r.booking.showtime?.movie?.title || 'N/A';
        const seat = r.bookingSeat?.seat ? `${r.bookingSeat.seat.seatRow}${r.bookingSeat.seat.seatNumber}` : 'N/A';
        const payStatus = r.booking.payment?.status || 'N/A';
        return `"${r.id}","${r.qrCode}","${r.booking.bookingCode}","${r.booking.account.email}","${name}","${movie}","${seat}",${payStatus},${r.updatedAt.toISOString()}`;
      }).join('\n');

      return {
        filename: `refunds-export-${query.from || 'all'}-${query.to || 'now'}.csv`,
        csv: headers + rows,
      };
    } catch (error) {
      this.logger.error(`Failed to export refunds CSV: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to export refunds');
    }
  }

  private transformRefund(ticket: RefundTicket) {
    return {
      id: ticket.id,
      qrCode: ticket.qrCode,
      status: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      booking: ticket.booking
        ? {
            id: ticket.booking.id,
            bookingCode: ticket.booking.bookingCode,
            totalPrice: Number(ticket.booking.totalPrice),
            account: ticket.booking.account
              ? {
                  email: ticket.booking.account.email,
                  profile: ticket.booking.account.profile
                    ? {
                        firstName: ticket.booking.account.profile.firstName,
                        lastName: ticket.booking.account.profile.lastName,
                      }
                    : null,
                }
              : null,
            showtime: ticket.booking.showtime
              ? {
                  startTime: ticket.booking.showtime.startTime,
                  movie: ticket.booking.showtime.movie
                    ? { title: ticket.booking.showtime.movie.title }
                    : null,
                }
              : null,
            payment: ticket.booking.payment
              ? {
                  provider: ticket.booking.payment.provider,
                  amount: Number(ticket.booking.payment.amount),
                  status: ticket.booking.payment.status,
                }
              : null,
          }
        : null,
      seat: ticket.bookingSeat?.seat
        ? {
            seatRow: ticket.bookingSeat.seat.seatRow,
            seatNumber: ticket.bookingSeat.seat.seatNumber,
            seatType: ticket.bookingSeat.seat.seatType,
          }
        : null,
    };
  }
}
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import type { Booking, Payment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SeatGateway } from '../seat/seat.gateway';
import {
  AdminBookingsQueryDto,
  AdminBookingExportDto,
  BookingsSortField,
  SortOrder,
} from './dto/bookings-admin-query.dto';

const bookingInclude = {
  account: {
    include: { profile: true },
  },
  showtime: {
    include: {
      movie: true,
      screen: {
        include: { theater: true },
      },
    },
  },
  bookingSeats: {
    include: { seat: true, ticket: true },
  },
  foodItems: {
    include: { foodItem: true },
  },
  payment: true,
  tickets: true,
} satisfies Prisma.BookingInclude;

type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

interface BookingSeatWithRelations {
  id: string;
  price: number | Prisma.Decimal;
  seat: { id: string; seatRow: string; seatNumber: number; seatType: string } | null;
  ticket: { id: string; qrCode: string; status: string; validatedAt: Date | null } | null;
}

interface FoodItemWithRelations {
  id: string;
  quantity: number;
  unitPrice: number | Prisma.Decimal;
  foodItem: { id: string; name: string; price: number | Prisma.Decimal } | null;
}

interface TicketInfo {
  id: string;
  qrCode: string;
  status: string;
  validatedAt: Date | null;
}

export interface AccountInfo {
  id: string;
  email: string;
  profile: { firstName: string | null; lastName: string | null; phone: string | null; avatarId: string | null } | null;
}

interface ShowtimeInfo {
  id: string;
  startTime: Date;
  endTime: Date;
  basePrice: number | Prisma.Decimal;
  movie: { id: string; title: string; language: string; posterId: string | null } | null;
  screen: { id: string; name: string; type: string; theater: { id: string; name: string } | null } | null;
}

interface PaymentInfo {
  id: string;
  provider: string;
  amount: number | Prisma.Decimal;
  currency: string;
  status: string;
  transactionRef: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

export interface TransformedBooking {
  id: string;
  bookingCode: string;
  totalPrice: number;
  status: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  account: AccountInfo | null;
  showtime: ShowtimeInfo | null;
  bookingSeats: BookingSeatWithRelations[];
  foodItems: FoodItemWithRelations[];
  payment: PaymentInfo | null;
  tickets: TicketInfo[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface CsvResult {
  filename: string;
  csv: string;
}

@Injectable()
export class BookingsAdminService {
  private readonly logger = new Logger(BookingsAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly seatGateway: SeatGateway,
  ) {}

  async findAll(query: AdminBookingsQueryDto): Promise<PaginatedResponse<TransformedBooking>> {
    try {
      const where = this.buildWhere(query);
      const orderBy = this.buildOrderBy(query);
      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      this.logger.log(`findAll: page=${page} limit=${limit} skip=${skip} status=${query.status} from=${query.from} to=${query.to}`);

      const [data, total] = await Promise.all([
        this.prisma.booking.findMany({ where, include: bookingInclude, orderBy, skip, take: limit }),
        this.prisma.booking.count({ where }),
      ]);

      this.logger.log(`findAll result: ${data.length} bookings, ${total} total`);

      return {
        data: data.map((b) => this.transformBooking(b)),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      this.logger.error('findAll failed', error instanceof Error ? error.stack : error);
      throw new InternalServerErrorException('Failed to fetch bookings');
    }
  }

  async findOne(id: string): Promise<TransformedBooking> {
    try {
      const booking = await this.prisma.booking.findUnique({ where: { id }, include: bookingInclude });
      if (!booking) throw new NotFoundException('Booking not found');
      return this.transformBooking(booking);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`findOne(${id}) failed`, error instanceof Error ? error.stack : error);
      throw new InternalServerErrorException('Failed to fetch booking');
    }
  }

  async cancel(id: string): Promise<TransformedBooking> {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id },
        include: { bookingSeats: true, payment: true },
      });

      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.status === BookingStatus.CANCELLED) throw new BadRequestException('Booking is already cancelled');
      if (booking.status === BookingStatus.CONFIRMED) throw new BadRequestException('Cannot cancel a confirmed booking');

      await this.prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id },
          data: { status: BookingStatus.CANCELLED },
        });
        if (booking.payment) {
          await tx.payment.update({
            where: { id: booking.payment.id },
            data: { status: PaymentStatus.REFUNDED },
          });
        }
      });

      if (booking.showtimeId) {
        for (const bs of booking.bookingSeats) {
          this.seatGateway.emitSeatUnlocked(booking.showtimeId, bs.seatId);
        }
      }

      this.logger.log(`Booking ${booking.bookingCode} cancelled by admin`);
      return this.findOne(id);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`cancel(${id}) failed`, error instanceof Error ? error.stack : error);
      throw new InternalServerErrorException('Failed to cancel booking');
    }
  }

  async exportCsv(query: AdminBookingExportDto): Promise<CsvResult> {
    try {
      const where: Prisma.BookingWhereInput = {};
      if (query.status) where.status = query.status;
      if (query.from || query.to) {
        where.createdAt = {};
        if (query.from) where.createdAt.gte = new Date(query.from);
        if (query.to) {
          const toEnd = new Date(query.to);
          toEnd.setHours(23, 59, 59, 999);
          where.createdAt.lte = toEnd;
        }
      }

      const bookings = await this.prisma.booking.findMany({
        where,
        include: {
          account: { include: { profile: true } },
          showtime: { include: { movie: true } },
          bookingSeats: true,
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const headers = 'Booking Code,Status,User Email,User Name,Movie,Showtime,Seats,Total Amount,Payment Status,Payment Provider,Created At\n';
      const rows = bookings.map((b) => {
        const name = [b.account?.profile?.firstName, b.account?.profile?.lastName].filter(Boolean).join(' ');
        return `"${b.bookingCode}",${b.status},"${b.account?.email || ''}","${name}","${b.showtime?.movie?.title || 'N/A'}",${b.showtime?.startTime ? new Date(b.showtime.startTime).toISOString() : 'N/A'},${b.bookingSeats.length},${b.totalPrice},${b.payment?.status || 'N/A'},${b.payment?.provider || 'N/A'},${b.createdAt.toISOString()}`;
      }).join('\n');

      return {
        filename: `bookings-export-${query.from || 'all'}-${query.to || 'now'}.csv`,
        csv: headers + rows,
      };
    } catch (error) {
      this.logger.error('exportCsv failed', error instanceof Error ? error.stack : error);
      throw new InternalServerErrorException('Failed to export bookings');
    }
  }

  private buildWhere(query: AdminBookingsQueryDto): Prisma.BookingWhereInput {
    const where: Prisma.BookingWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) {
        const toEnd = new Date(query.to);
        toEnd.setHours(23, 59, 59, 999);
        where.createdAt.lte = toEnd;
      }
    }
    if (query.search) {
      const term = query.search;
      where.OR = [
        { bookingCode: { contains: term, mode: 'insensitive' } },
        { account: { email: { contains: term, mode: 'insensitive' } } },
        { account: { profile: { firstName: { contains: term, mode: 'insensitive' } } } },
        { account: { profile: { lastName: { contains: term, mode: 'insensitive' } } } },
        { showtime: { movie: { title: { contains: term, mode: 'insensitive' } } } },
      ];
    }
    return where;
  }

  private buildOrderBy(query: AdminBookingsQueryDto): Prisma.BookingOrderByWithRelationInput {
    const orderBy: Prisma.BookingOrderByWithRelationInput = {};
    const sortField = query.sortBy || BookingsSortField.CREATED_AT;
    const sortOrder = query.sortOrder || SortOrder.DESC;
    orderBy[sortField === BookingsSortField.BOOKING_CODE ? 'bookingCode' : sortField] = sortOrder;
    return orderBy;
  }

  private transformBooking(booking: BookingWithRelations): TransformedBooking {
    return {
      id: booking.id,
      bookingCode: booking.bookingCode,
      totalPrice: Number(booking.totalPrice),
      status: booking.status,
      expiresAt: booking.expiresAt,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      account: booking.account
        ? {
            id: booking.account.id,
            email: booking.account.email,
            profile: booking.account.profile
              ? {
                  firstName: booking.account.profile.firstName,
                  lastName: booking.account.profile.lastName,
                  phone: booking.account.profile.phone,
                  avatarId: booking.account.profile.avatarId,
                }
              : null,
          }
        : null,
      showtime: booking.showtime
        ? {
            id: booking.showtime.id,
            startTime: booking.showtime.startTime,
            endTime: booking.showtime.endTime,
            basePrice: Number(booking.showtime.basePrice),
            movie: booking.showtime.movie
              ? {
                  id: booking.showtime.movie.id,
                  title: booking.showtime.movie.title,
                  language: booking.showtime.movie.language,
                  posterId: booking.showtime.movie.posterId,
                }
              : null,
            screen: booking.showtime.screen
              ? {
                  id: booking.showtime.screen.id,
                  name: booking.showtime.screen.name,
                  type: booking.showtime.screen.type,
                  theater: booking.showtime.screen.theater
                    ? {
                        id: booking.showtime.screen.theater.id,
                        name: booking.showtime.screen.theater.name,
                      }
                    : null,
                }
              : null,
          }
        : null,
      bookingSeats: (booking.bookingSeats || []).map((bs) => ({
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
              validatedAt: bs.ticket.validatedAt,
            }
          : null,
      })),
      foodItems: (booking.foodItems || []).map((fi) => ({
        id: fi.id,
        quantity: fi.quantity,
        unitPrice: Number(fi.unitPrice),
        foodItem: fi.foodItem
          ? {
              id: fi.foodItem.id,
              name: fi.foodItem.name,
              price: Number(fi.foodItem.price),
            }
          : null,
      })),
      payment: booking.payment
        ? {
            id: booking.payment.id,
            provider: booking.payment.provider,
            amount: Number(booking.payment.amount),
            currency: booking.payment.currency,
            status: booking.payment.status,
            transactionRef: booking.payment.transactionRef,
            paidAt: booking.payment.paidAt,
            createdAt: booking.payment.createdAt,
          }
        : null,
      tickets: (booking.tickets || []).map((t) => ({
        id: t.id,
        qrCode: t.qrCode,
        status: t.status,
        validatedAt: t.validatedAt,
      })),
    };
  }
}

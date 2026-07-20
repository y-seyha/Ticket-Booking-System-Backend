/* eslint-disable */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, PaymentProvider, PaymentStatus } from '@prisma/client';
import { CreateCheckoutDto, CheckoutResponseDto } from './dto/create-checkout.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import * as crypto from 'crypto';
import { SeatGateway } from '../seat/seat.gateway';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly seatGateway: SeatGateway,
  ) {}

  async prepareCheckout(accountId: string) {
    const now = new Date();

    const categories = await this.prisma.foodCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const foodCategories = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      items: cat.items.map((item) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price),
      })),
    }));

    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        status: PaymentStatus.PENDING,
        expiresAt: { gt: now },
        booking: { accountId, status: BookingStatus.PENDING },
      },
      include: {
        booking: {
          include: {
            bookingSeats: { include: { seat: true } },
            foodItems: { include: { foodItem: true } },
          },
        },
      },
    });

    if (existingPayment) {
      return {
        valid: true,
        existingCheckout: true,
        bookingId: existingPayment.booking.id,
        bookingCode: existingPayment.booking.bookingCode,
        totalAmount: Number(existingPayment.booking.totalPrice),
        paymentId: existingPayment.id,
        paymentProvider: existingPayment.provider,
        paymentExpiresAt: existingPayment.expiresAt,
        foodCategories,
      };
    }

    const locks = await this.prisma.seatLock.findMany({
      where: { accountId, expiresAt: { gt: now } },
      include: {
        seat: true,
        showtime: {
          include: {
            movie: true,
            screen: { include: { theater: true, template: true } },
          },
        },
      },
    });

    if (!locks.length) {
      return {
        valid: false,
        error: 'CART_EMPTY',
        message:
          'Your cart is empty or seat locks have expired. Please select seats again.',
      };
    }

    const showtimeId = locks[0].showtimeId;
    if (locks.some((l) => l.showtimeId !== showtimeId)) {
      return {
        valid: false,
        error: 'MIXED_SHOWTIMES',
        message: 'All seats must belong to the same showtime.',
      };
    }

    const pricingRules = await this.prisma.seatPricingRule.findMany({
      where: { isActive: true },
    });
    const pricingMap = Object.fromEntries(
      pricingRules.map((r) => [r.seatType, Number(r.seatSurcharge)]),
    );

    const seats = locks.map((lock) => {
      const basePrice = Number(lock.showtime.basePrice);
      const screenSurcharge = Number(
        lock.showtime.screen.template.screenSurcharge,
      );
      const seatSurcharge = pricingMap[lock.seat.seatType] ?? 0;
      return {
        seatId: lock.seat.id,
        seatRow: lock.seat.seatRow,
        seatNumber: lock.seat.seatNumber,
        seatType: lock.seat.seatType,
        price: basePrice + screenSurcharge + seatSurcharge,
      };
    });

    return {
      valid: true,
      showtime: {
        id: showtimeId,
        startTime: locks[0].showtime.startTime,
        endTime: locks[0].showtime.endTime,
        movie: {
          id: locks[0].showtime.movie.id,
          title: locks[0].showtime.movie.title,
          durationMinutes: locks[0].showtime.movie.durationMinutes,
          language: locks[0].showtime.movie.language,
        },
        screen: {
          name: locks[0].showtime.screen.name,
          theater: locks[0].showtime.screen.theater,
        },
      },
      seats,
      totalAmount: seats.reduce((sum, s) => sum + s.price, 0),
      foodCategories,
    };
  }

  async checkout(accountId: string, dto: CreateCheckoutDto): Promise<CheckoutResponseDto> {
    try {
      const now = new Date();

      const existingPayment = await this.prisma.payment.findFirst({
        where: {
          status: PaymentStatus.PENDING,
          expiresAt: { gt: now },
          booking: {
            accountId,
            status: BookingStatus.PENDING,
          },
        },
        include: {
          booking: true,
        },
      });

      if (existingPayment) {
        const freshExpiry = new Date(Date.now() + 5 * 60 * 1000);

        await this.prisma.payment.update({
          where: { id: existingPayment.id },
          data: {
            expiresAt: freshExpiry,
            ...(dto.paymentProvider ? { provider: dto.paymentProvider } : {}),
          },
        });

        await this.prisma.booking.update({
          where: { id: existingPayment.booking.id },
          data: { expiresAt: freshExpiry },
        });

        const refreshed = await this.prisma.payment.findUnique({
          where: { id: existingPayment.id },
          include: { booking: true },
        });

        if (!refreshed) {
          throw new NotFoundException('Payment not found after refresh');
        }

        return this.mapCheckoutResponse(refreshed.booking, refreshed);
      }

      const locks = await this.prisma.seatLock.findMany({
        where: {
          accountId,
          expiresAt: { gt: now },
        },
        include: {
          seat: true,
          showtime: {
            include: {
              screen: {
                include: {
                  template: true,
                },
              },
            },
          },
        },
      });

      if (!locks.length) {
        throw new BadRequestException({
          error: 'CART_EMPTY',
          message: 'Your cart is empty or seat locks have expired.',
        });
      }

      const showtimeId = locks[0].showtimeId;
      const mixedShowtimes = locks.some((lock) => lock.showtimeId !== showtimeId);

      if (mixedShowtimes) {
        throw new BadRequestException({
          error: 'MIXED_SHOWTIMES',
          message: 'All seats must belong to the same showtime.',
        });
      }

      // Calculate totals using pricing maps
      const pricingRules = await this.prisma.seatPricingRule.findMany({
        where: { isActive: true },
      });

      const pricingMap = Object.fromEntries(
        pricingRules.map((rule) => [rule.seatType, Number(rule.seatSurcharge)]),
      );

      let totalAmount = 0;
      for (const lock of locks) {
        const basePrice = Number(lock.showtime.basePrice);
        const screenSurcharge = Number(lock.showtime.screen.template.screenSurcharge);
        const seatSurcharge = pricingMap[lock.seat.seatType] ?? 0;
        totalAmount += basePrice + screenSurcharge + seatSurcharge;
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const PAYMENT_TIMEOUT_MS = 5 * 60 * 1000;

        const occupiedSeats = await tx.bookingSeat.findMany({
          where: {
            seatId: { in: locks.map((lock) => lock.seatId) },
            showtimeId,
            booking: {
              status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
            },
          },
        });

        if (occupiedSeats.length > 0) {
          throw new BadRequestException({
            error: 'SEATS_OCCUPIED',
            message: 'One or more seats are no longer available.',
          });
        }

        const paymentExpiresAt = new Date(Date.now() + PAYMENT_TIMEOUT_MS);

        const booking = await tx.booking.create({
          data: {
            accountId,
            showtimeId,
            bookingCode: crypto.randomUUID(),
            totalPrice: totalAmount,
            status: BookingStatus.PENDING,
            expiresAt: paymentExpiresAt,
          },
        });

        await tx.bookingSeat.createMany({
          data: locks.map((lock) => {
            const basePrice = Number(lock.showtime.basePrice);
            const screenSurcharge = Number(lock.showtime.screen.template.screenSurcharge);
            const seatSurcharge = pricingMap[lock.seat.seatType] ?? 0;

            return {
              bookingId: booking.id,
              seatId: lock.seatId,
              showtimeId: lock.showtimeId,
              price: basePrice + screenSurcharge + seatSurcharge,
            };
          }),
        });

        let foodTotal = 0;

        if (dto.foodItems?.length) {
          const foodItemIds = dto.foodItems.map((f) => f.foodItemId);
          const foodItems = await tx.foodItem.findMany({
            where: { id: { in: foodItemIds }, isActive: true },
          });

          if (foodItems.length !== foodItemIds.length) {
            throw new BadRequestException({
              error: 'INVALID_FOOD_ITEMS',
              message: 'One or more food items are invalid or inactive.',
            });
          }

          const foodPriceMap = Object.fromEntries(
            foodItems.map((fi) => [fi.id, Number(fi.price)]),
          );

          await tx.bookingFoodItem.createMany({
            data: dto.foodItems.map((fi) => ({
              bookingId: booking.id,
              foodItemId: fi.foodItemId,
              quantity: fi.quantity,
              unitPrice: foodPriceMap[fi.foodItemId],
            })),
          });

          for (const fi of dto.foodItems) {
            foodTotal += foodPriceMap[fi.foodItemId] * fi.quantity;
          }

          if (foodTotal > 0) {
            await tx.booking.update({
              where: { id: booking.id },
              data: { totalPrice: totalAmount + foodTotal },
            });
          }

          totalAmount += foodTotal;
        }

        const payment = await tx.payment.create({
          data: {
            bookingId: booking.id,
            // Fallback to digital method placeholder if not picked yet
            provider: dto.paymentProvider || PaymentProvider.KHQR,
            amount: totalAmount,
            status: PaymentStatus.PENDING,
            expiresAt: paymentExpiresAt,
          },
        });

        await tx.seatLock.deleteMany({
          where: {
            id: { in: locks.map((lock) => lock.id) },
          },
        });

        this.seatGateway.emitSeatsBooked(
          showtimeId,
          locks.map((lock) => lock.seatId),
        );

        return { booking, payment };
      });

      return this.mapCheckoutResponse(result.booking, result.payment);

    } catch (error) {
      this.logger.error(error.message, error.stack);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Checkout failed');
    }
  }

  public mapCheckoutResponse(booking: any, payment: any): CheckoutResponseDto {
    let qrCode: string | undefined;
    let paymentUrl: string | undefined;

    // Simulate returning specific properties based on the configured method
    if (payment.provider === PaymentProvider.KHQR) {
      qrCode = `00020101021252040000...sample-khqr-data-for-booking-${booking.bookingCode}`;
    } else if (payment.provider === PaymentProvider.STRIPE) {
      paymentUrl = `https://checkout.stripe.com/pay/mock_session_${payment.id}`;
    }

    return {
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      totalAmount: Number(booking.totalPrice),
      bookingStatus: booking.status,
      paymentId: payment.id,
      paymentProvider: payment.provider,
      paymentStatus: payment.status,
      paymentExpiresAt: payment.expiresAt,
      qrCode,
      paymentUrl,
    };
  }

  @Cron('*/30 * * * * *')
  async expireBookings() {
    const now = new Date();

    const expired = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING,
        expiresAt: { lt: now },
      },
      include: {
        bookingSeats: true,
      },
    });

    if (!expired.length) return;

    const ids = expired.map((b) => b.id);

    await this.prisma.$transaction([
      this.prisma.booking.updateMany({
        where: { id: { in: ids } },
        data: { status: BookingStatus.EXPIRED },
      }),
      this.prisma.payment.updateMany({
        where: { bookingId: { in: ids } },
        data: { status: PaymentStatus.EXPIRED },
      }),
      this.prisma.bookingSeat.deleteMany({
        where: { bookingId: { in: ids } },
      }),
    ]);

    this.logger.log(`Expired ${ids.length} bookings`);

    for (const booking of expired) {
      if (!booking.showtimeId) continue;
      this.seatGateway.emitSeatsExpired(
        booking.showtimeId,
        booking.bookingSeats.map((bs) => bs.seatId),
      );
    }
  }
}


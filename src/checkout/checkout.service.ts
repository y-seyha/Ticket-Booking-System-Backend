// import {
//   BadRequestException,
//   Injectable,
//   InternalServerErrorException,
//   Logger,
// } from '@nestjs/common';
//
// import { BookingStatus, PaymentStatus } from '@prisma/client';
//
// import { CreateCheckoutDto } from './dto/create-checkout.dto';
// import { PrismaService } from '../prisma/prisma.service';
// import { Cron } from '@nestjs/schedule';
//
// @Injectable()
// export class CheckoutService {
//   private readonly logger = new Logger(CheckoutService.name);
//
//   constructor(private readonly prisma: PrismaService) {}
//
//   async checkout(accountId: string, dto: CreateCheckoutDto) {
//     try {
//       const now = new Date();
//
//       const locks = await this.prisma.seatLock.findMany({
//         where: {
//           accountId,
//           expiresAt: {
//             gt: now,
//           },
//         },
//         include: {
//           seat: true,
//           showtime: {
//             include: {
//               screen: {
//                 include: {
//                   template: true,
//                 },
//               },
//             },
//           },
//         },
//       });
//
//       if (!locks.length) {
//         throw new BadRequestException('Cart is empty');
//       }
//
//       const showtimeId = locks[0].showtimeId;
//
//       const mixedShowtimes = locks.some(
//         (lock) => lock.showtimeId !== showtimeId,
//       );
//
//       if (mixedShowtimes) {
//         throw new BadRequestException(
//           'All seats must belong to the same showtime',
//         );
//       }
//
//       const pricingRules = await this.prisma.seatPricingRule.findMany({
//         where: {
//           isActive: true,
//         },
//       });
//
//       const pricingMap = Object.fromEntries(
//         pricingRules.map((rule) => [rule.seatType, Number(rule.seatSurcharge)]),
//       );
//
//       let totalAmount = 0;
//
//       for (const lock of locks) {
//         const basePrice = Number(lock.showtime.basePrice);
//
//         const screenSurcharge = Number(
//           lock.showtime.screen.template.screenSurcharge,
//         );
//
//         const seatSurcharge = pricingMap[lock.seat.seatType] ?? 0;
//
//         totalAmount += basePrice + screenSurcharge + seatSurcharge;
//       }
//
//       const result = await this.prisma.$transaction(async (tx) => {
//         const PAYMENT_TIMEOUT_MS = 60 * 1000;
//
//         const occupiedSeats = await tx.bookingSeat.findMany({
//           where: {
//             seatId: {
//               in: locks.map((lock) => lock.seatId),
//             },
//             showtimeId,
//             booking: {
//               status: {
//                 in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
//               },
//             },
//           },
//         });
//
//         if (occupiedSeats.length > 0) {
//           throw new BadRequestException(
//             'One or more seats are no longer available',
//           );
//         }
//
//         const paymentExpiresAt = new Date(Date.now() + PAYMENT_TIMEOUT_MS);
//
//         const booking = await tx.booking.create({
//           data: {
//             accountId,
//             showtimeId,
//             bookingCode: crypto.randomUUID(),
//             totalPrice: totalAmount,
//             status: BookingStatus.PENDING,
//             expiresAt: paymentExpiresAt,
//           },
//         });
//
//         await tx.bookingSeat.createMany({
//           data: locks.map((lock) => {
//             const basePrice = Number(lock.showtime.basePrice);
//
//             const screenSurcharge = Number(
//               lock.showtime.screen.template.screenSurcharge,
//             );
//
//             const seatSurcharge = pricingMap[lock.seat.seatType] ?? 0;
//
//             return {
//               bookingId: booking.id,
//               seatId: lock.seatId,
//               showtimeId: lock.showtimeId,
//               price: basePrice + screenSurcharge + seatSurcharge,
//             };
//           }),
//         });
//
//         const payment = await tx.payment.create({
//           data: {
//             bookingId: booking.id,
//             provider: dto.paymentProvider,
//             amount: totalAmount,
//             status: PaymentStatus.PENDING,
//             expiresAt: paymentExpiresAt,
//           },
//         });
//
//         await tx.seatLock.deleteMany({
//           where: {
//             id: {
//               in: locks.map((lock) => lock.id),
//             },
//           },
//         });
//
//         return {
//           booking,
//           payment,
//         };
//       });
//
//       return {
//         bookingId: result.booking.id,
//
//         bookingCode: result.booking.bookingCode,
//
//         totalAmount,
//
//         bookingStatus: result.booking.status,
//
//         bookingExpiresAt: result.booking.expiresAt,
//
//         paymentId: result.payment.id,
//
//         paymentProvider: result.payment.provider,
//
//         paymentStatus: result.payment.status,
//
//         paymentExpiresAt: result.payment.expiresAt,
//       };
//     } catch (error) {
//       this.logger.error(error.message, error.stack);
//
//       if (error instanceof BadRequestException) {
//         throw error;
//       }
//
//       throw new InternalServerErrorException('Checkout failed');
//     }
//   }
//
//   @Cron('*/30 * * * * *') // every 30s
//   async expireBookings() {
//     const now = new Date();
//
//     const expired = await this.prisma.booking.findMany({
//       where: {
//         status: BookingStatus.PENDING,
//         expiresAt: { lt: now },
//       },
//     });
//
//     if (!expired.length) return;
//
//     const ids = expired.map((b) => b.id);
//
//     await this.prisma.$transaction([
//       this.prisma.booking.updateMany({
//         where: { id: { in: ids } },
//         data: { status: BookingStatus.EXPIRED },
//       }),
//
//       this.prisma.payment.updateMany({
//         where: { bookingId: { in: ids } },
//         data: { status: PaymentStatus.EXPIRED },
//       }),
//
//       this.prisma.bookingSeat.deleteMany({
//         where: { bookingId: { in: ids } },
//       }),
//     ]);
//
//     this.logger.log(`Expired ${ids.length} bookings`);
//   }
// }

/* eslint-disable */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(private readonly prisma: PrismaService) {}

  async checkout(accountId: string, dto: CreateCheckoutDto) {
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
        if (existingPayment.provider !== dto.paymentProvider) {
          const updatedPayment = await this.prisma.payment.update({
            where: { id: existingPayment.id },
            data: { provider: dto.paymentProvider },
            include: { booking: true },
          });
          return this.mapCheckoutResponse(updatedPayment.booking, updatedPayment);
        }

        return this.mapCheckoutResponse(existingPayment.booking, existingPayment);
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
        throw new BadRequestException('Cart is empty');
      }

      const showtimeId = locks[0].showtimeId;
      const mixedShowtimes = locks.some((lock) => lock.showtimeId !== showtimeId);

      if (mixedShowtimes) {
        throw new BadRequestException('All seats must belong to the same showtime');
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
        const PAYMENT_TIMEOUT_MS = 5* 60 * 1000;

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
          throw new BadRequestException('One or more seats are no longer available');
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

        const payment = await tx.payment.create({
          data: {
            bookingId: booking.id,
            provider: dto.paymentProvider,
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


  private mapCheckoutResponse(booking: any, payment: any) {
    return {
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      totalAmount: booking.totalPrice,
      bookingStatus: booking.status,
      bookingExpiresAt: booking.expiresAt,
      paymentId: payment.id,
      paymentProvider: payment.provider,
      paymentStatus: payment.status,
      paymentExpiresAt: payment.expiresAt,
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
  }
}


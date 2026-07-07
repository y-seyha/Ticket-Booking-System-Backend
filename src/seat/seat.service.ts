import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeatLockDto } from './dto/create-seat-lock.dto';
import { BookingStatus, Prisma } from '@prisma/client';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class SeatService {
  private readonly logger = new Logger(SeatService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSeatsByScreen(screenId: string) {
    try {
      return await this.prisma.seat.findMany({
        where: { screenId },
        orderBy: [{ seatRow: 'asc' }, { seatNumber: 'asc' }],
      });
    } catch (error) {
      this.logger.error(
        'Failed to fetch seats',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException();
    }
  }

  async getSeatMap(showtimeId: string) {
    const now = new Date();

    const [showtime, pricingRules] = await Promise.all([
      this.prisma.showtime.findUnique({
        where: { id: showtimeId },
        include: {
          screen: {
            include: {
              seats: true,
            },
          },
          seatLocks: {
            where: {
              expiresAt: {
                gt: now,
              },
            },
          },
          bookingSeats: {
            where: {
              booking: {
                status: {
                  in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
                },
              },
            },
            include: {
              booking: true,
            },
          },
        },
      }),

      this.prisma.seatPricingRule.findMany({
        where: {
          isActive: true,
        },
      }),
    ]);

    if (!showtime) {
      throw new NotFoundException('Showtime not found');
    }

    const pricingMap = Object.fromEntries(
      pricingRules.map((rule) => [rule.seatType, Number(rule.seatSurcharge)]),
    );

    const lockedSeatIds = new Set(
      showtime.seatLocks.map((lock) => lock.seatId),
    );

    const pendingSeatIds = new Set(
      showtime.bookingSeats
        .filter((seat) => seat.booking.status === BookingStatus.PENDING)
        .map((seat) => seat.seatId),
    );

    const bookedSeatIds = new Set(
      showtime.bookingSeats
        .filter((seat) => seat.booking.status === BookingStatus.CONFIRMED)
        .map((seat) => seat.seatId),
    );

    return showtime.screen.seats.map((seat) => {
      let status: 'AVAILABLE' | 'LOCKED' | 'BOOKED' = 'AVAILABLE';

      if (bookedSeatIds.has(seat.id)) {
        status = 'BOOKED';
      } else if (lockedSeatIds.has(seat.id) || pendingSeatIds.has(seat.id)) {
        status = 'LOCKED';
      }

      return {
        id: seat.id,
        seatRow: seat.seatRow,
        seatNumber: seat.seatNumber,
        posX: seat.posX,
        posY: seat.posY,
        seatType: seat.seatType,
        status,
        surcharge: pricingMap[seat.seatType] ?? 0,
      };
    });
  }

  //add to cart
  async lockSeat(accountId: string, dto: CreateSeatLockDto) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const [seat, showtime] = await Promise.all([
          tx.seat.findUnique({
            where: { id: dto.seatId },
          }),
          tx.showtime.findUnique({
            where: { id: dto.showtimeId },
          }),
        ]);

        if (!seat) {
          throw new NotFoundException('Seat not found');
        }

        if (!showtime) {
          throw new NotFoundException('Showtime not found');
        }

        const now = new Date();

        // Remove expired lock if exists
        await tx.seatLock.deleteMany({
          where: {
            seatId: dto.seatId,
            showtimeId: dto.showtimeId,
            expiresAt: {
              lte: now,
            },
          },
        });

        // Check if seat already booked
        const bookedSeat = await tx.bookingSeat.findFirst({
          where: {
            seatId: dto.seatId,
            showtimeId: dto.showtimeId,
            booking: {
              status: {
                in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
              },
            },
          },
        });

        if (bookedSeat) {
          throw new BadRequestException('Seat already booked');
        }

        // Check active lock
        const activeLock = await tx.seatLock.findUnique({
          where: {
            showtimeId_seatId: {
              showtimeId: dto.showtimeId,
              seatId: dto.seatId,
            },
          },
        });

        if (activeLock) {
          if (activeLock.accountId === accountId) {
            return {
              message: 'Seat already locked by you',
              lock: activeLock,
            };
          }

          throw new BadRequestException('Seat already locked');
        }

        // Optional seat limit
        const currentLockCount = await tx.seatLock.count({
          where: {
            accountId,
            showtimeId: dto.showtimeId,
            expiresAt: {
              gt: now,
            },
          },
        });

        if (currentLockCount >= 10) {
          throw new BadRequestException('Maximum 10 seats allowed per booking');
        }

        //Time Countdown
        const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
        // const expiresAt = new Date(now.getTime() + 60 * 1000);

        const lock = await tx.seatLock.create({
          data: {
            accountId,
            seatId: dto.seatId,
            showtimeId: dto.showtimeId,
            expiresAt,
          },
        });

        return {
          message: 'Seat locked successfully',
          lock,
        };
      });

      return result;
    } catch (error) {
      this.logger.error(
        'Seat lock failed',
        error instanceof Error ? error.stack : String(error),
      );

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Handle race condition
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Seat already locked');
      }

      throw new InternalServerErrorException();
    }
  }

  async getMyLockedSeats(accountId: string) {
    const now = new Date();

    const [locks, pricingRules] = await Promise.all([
      this.prisma.seatLock.findMany({
        where: {
          accountId,
          expiresAt: { gt: now },
        },
        include: {
          account: {
            include: {
              profile: true,
            },
          },
          seat: true,
          showtime: {
            include: {
              movie: true,
              screen: {
                include: {
                  theater: true,
                  template: true,
                },
              },
            },
          },
        },
      }),

      this.prisma.seatPricingRule.findMany({
        where: { isActive: true },
      }),
    ]);

    // seat surcharge map
    const pricingMap = Object.fromEntries(
      pricingRules.map((rule) => [rule.seatType, Number(rule.seatSurcharge)]),
    );

    if (locks.length === 0) {
      return {
        user: accountId,
        items: [],
        summary: {
          itemCount: 0,
          totalAmount: 0,
        },
      };
    }

    const user = locks[0].account;

    let totalAmount = 0;

    const items = locks.map((lock) => {
      const basePrice = Number(lock.showtime.basePrice);

      const screenSurcharge = Number(
        lock.showtime.screen.template.screenSurcharge,
      );

      const seatSurcharge = pricingMap[lock.seat.seatType] ?? 0;

      const total = basePrice + screenSurcharge + seatSurcharge;

      totalAmount += total;

      return {
        lockId: lock.id,
        expiresAt: lock.expiresAt,

        movie: {
          id: lock.showtime.movie.id,
          title: lock.showtime.movie.title,
        },

        theater: {
          id: lock.showtime.screen.theater.id,
          name: lock.showtime.screen.theater.name,
        },

        screen: {
          id: lock.showtime.screen.id,
          name: lock.showtime.screen.name,
        },

        seat: {
          id: lock.seat.id,
          row: lock.seat.seatRow,
          number: lock.seat.seatNumber,
          type: lock.seat.seatType,
        },

        pricing: {
          basePrice,
          screenSurcharge,
          seatSurcharge,
          total,
        },
      };
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile
          ? {
              firstName: user.profile.firstName,
              lastName: user.profile.lastName,
              phone: user.profile.phone,
            }
          : null,
      },

      items,

      summary: {
        itemCount: items.length,
        totalAmount,
      },
    };
  }


  async clearMyCart(accountId: string) {
    const result = await this.prisma.seatLock.deleteMany({
      where: { accountId },
    });

    return {
      message: 'Cart cleared successfully',
      count: result.count,
    };
  }

  //remove seat from SeatLock(Cart)
  async unlockSeat(accountId: string, seatId: string, showtimeId: string) {
    const lock = await this.prisma.seatLock.findUnique({
      where: {
        showtimeId_seatId: {
          showtimeId,
          seatId,
        },
      },
    });

    if (!lock) {
      throw new NotFoundException('Lock not found');
    }

    if (lock.accountId !== accountId) {
      throw new BadRequestException('You do not own this seat lock');
    }

    await this.prisma.seatLock.delete({
      where: {
        id: lock.id,
      },
    });

    return {
      message: 'Seat unlocked successfully',
    };
  }

  @Cron('*/30 * * * * *')
  async cleanupExpiredLocks() {
    const result = await this.prisma.seatLock.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Removed ${result.count} expired seat locks`);
    }
  }
}

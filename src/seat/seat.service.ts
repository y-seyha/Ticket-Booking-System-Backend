import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeatLockDto } from './dto/create-seat-lock.dto';

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
        try {
            const showtime = await this.prisma.showtime.findUnique({
                where: { id: showtimeId },
                include: {
                    screen: { include: { seats: true } },
                    seatLocks: true,
                    bookingSeats: true,
                },
            });

            if (!showtime) {
                throw new NotFoundException('Showtime not found');
            }

            const now = new Date();

            const activeLocks = showtime.seatLocks.filter(
                (l) => l.expiresAt > now,
            );

            const lockedSeatIds = new Set(activeLocks.map((l) => l.seatId));
            const bookedSeatIds = new Set(
                showtime.bookingSeats.map((b) => b.seatId),
            );

            return showtime.screen.seats.map((seat) => ({
                ...seat,
                isLocked: lockedSeatIds.has(seat.id),
                isBooked: bookedSeatIds.has(seat.id),
            }));

        } catch (error) {
            this.logger.error('Failed to get seat map', error instanceof Error ? error.stack : String(error));
            if (
                error instanceof NotFoundException ||
                error instanceof BadRequestException
            ) {
                throw error;
            }

            throw new InternalServerErrorException();
        }
    }

    //add to cart
    async lockSeat(accountId: string, dto: CreateSeatLockDto) {
        try {
            const seat = await this.prisma.seat.findUnique({
                where: { id: dto.seatId },
            });

            if (!seat) {
                throw new NotFoundException('Seat not found');
            }

            const showtime = await this.prisma.showtime.findUnique({
                where: { id: dto.showtimeId },
            });

            if (!showtime) {
                throw new NotFoundException('Showtime not found');
            }

            const now = new Date();

            // check existing lock (not expired)
            const existingLock = await this.prisma.seatLock.findUnique({
                where: {
                    showtimeId_seatId: {
                        showtimeId: dto.showtimeId,
                        seatId: dto.seatId,
                    },
                },
            });

            if (existingLock && existingLock.expiresAt > now) {
                throw new BadRequestException('Seat already locked');
            }

            //create lock (5 minutes)
            const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

            const lock = await this.prisma.seatLock.create({
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
        } catch (error) {
            this.logger.error('Seat lock failed', error.stack);

            if (
                error instanceof NotFoundException ||
                error instanceof BadRequestException
            ) {
                throw error;
            }

            throw new InternalServerErrorException();
        }
    }

    async unlockSeat(accountId: string, seatId: string, showtimeId: string) {
        try {
            const lock = await this.prisma.seatLock.findUnique({
                where: {
                    showtimeId_seatId: { showtimeId, seatId },
                },
            });

            if (!lock) {
                throw new NotFoundException('Lock not found');
            }

            if (lock.accountId !== accountId) {
                throw new BadRequestException('Not your seat lock');
            }

            await this.prisma.seatLock.delete({
                where: { id: lock.id },
            });

            return { message: 'Seat unlocked' };
        } catch (error) {
            this.logger.error('Unlock seat failed', error.stack);

            if (
                error instanceof NotFoundException ||
                error instanceof BadRequestException
            ) {
                throw error;
            }

            throw new InternalServerErrorException();
        }
    }

    async cleanupExpiredLocks() {
        try {
            const result = await this.prisma.seatLock.deleteMany({
                where: {
                    expiresAt: { lt: new Date() },
                },
            });

            this.logger.log(`Cleaned ${result.count} expired locks`);

            return result;
        } catch (error) {
            this.logger.error('Cleanup failed', error instanceof Error ? error.stack : String(error));

            throw new InternalServerErrorException('Failed to cleanup expired locks');
        }
    }
}
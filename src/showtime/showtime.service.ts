import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ConflictException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShowtimeDto } from './dto/create-showtime.dto';
import { UpdateShowtimeDto } from './dto/update-showtime.dto';
import {ShowtimeStatus,} from '@prisma/client';

@Injectable()
export class ShowtimeService {
    private readonly logger = new Logger(
        ShowtimeService.name,
    );

    constructor(
        private readonly prisma: PrismaService,
    ) {}

    async create(dto: CreateShowtimeDto,) {
        try {
            const movie =
                await this.prisma.movie.findUnique({
                    where: {
                        id: dto.movieId,
                    },
                });

            if (!movie) {
                throw new NotFoundException(
                    'Movie not found',
                );
            }

            const screen =
                await this.prisma.screen.findUnique({
                    where: {
                        id: dto.screenId,
                    },
                });

            if (!screen) {
                throw new NotFoundException(
                    'Screen not found',
                );
            }

            const startTime = new Date(
                dto.startTime,
            );

            const endTime = new Date(
                dto.endTime,
            );

            if (startTime >= endTime) {
                throw new BadRequestException(
                    'End time must be after start time',
                );
            }

            const overlap =
                await this.prisma.showtime.findFirst({
                    where: {
                        screenId: dto.screenId,
                        status:
                        ShowtimeStatus.SCHEDULED,
                        AND: [
                            {
                                startTime: {
                                    lt: endTime,
                                },
                            },
                            {
                                endTime: {
                                    gt: startTime,
                                },
                            },
                        ],
                    },
                });

            if (overlap) {
                throw new ConflictException(
                    'Screen already has another showtime during this period',
                );
            }

            return await this.prisma.showtime.create({
                data: {
                    movieId: dto.movieId,
                    screenId: dto.screenId,
                    startTime,
                    endTime,
                    basePrice: dto.basePrice,
                    status: dto.status,
                },
                include: {
                    movie: true,
                    screen: true,
                },
            });
        } catch (error) {
            this.logger.error(
                'Failed to create showtime',
                error?.stack,
            );

            if (
                error instanceof NotFoundException ||
                error instanceof BadRequestException ||
                error instanceof ConflictException
            ) {
                throw error;
            }

            throw new InternalServerErrorException(
                'Failed to create showtime',
            );
        }
    }

    async findAll() {
        try {
            return await this.prisma.showtime.findMany({
                include: {
                    movie: true,
                    screen: {
                        include: {
                            theater: true,
                        },
                    },
                },
                orderBy: {
                    startTime: 'asc',
                },
            });
        } catch (error) {
            this.logger.error(
                'Failed to fetch showtimes',
                error?.stack,
            );

            throw new InternalServerErrorException(
                'Failed to fetch showtimes',
            );
        }
    }

    async findOne(id: string) {
        try {
            const now = new Date();

            const [showtime, pricing, seatLocks, bookingSeats] =
                await Promise.all([
                    this.prisma.showtime.findUnique({
                        where: { id },
                        include: {
                            movie: true,
                            screen: {
                                include: {
                                    theater: true,
                                    seats: true,
                                },
                            },
                        },
                    }),

                    this.prisma.seatPricingRule.findMany({
                        where: { isActive: true },
                    }),

                    this.prisma.seatLock.findMany({
                        where: {
                            showtimeId: id,
                            expiresAt: { gt: now },
                        },
                        select: {
                            seatId: true,
                        },
                    }),

                    this.prisma.bookingSeat.findMany({
                        where: { showtimeId: id },
                        select: {
                            seatId: true,
                        },
                    }),
                ]);

            if (!showtime) {
                throw new NotFoundException('Showtime not found');
            }

            // PRICE MAP
            const pricingMap = Object.fromEntries(
                pricing.map(p => [
                    p.seatType,
                    Number(p.seatSurcharge),
                ]),
            );

            // FAST LOOKUPS
            const lockedSeatSet = new Set(seatLocks.map(l => l.seatId),);

            const bookedSeatSet = new Set(
                bookingSeats.map(b => b.seatId),
            );

            const seats = showtime.screen.seats.map(seat => {
                let status: 'AVAILABLE' | 'LOCKED' | 'BOOKED' = 'AVAILABLE';

                if (bookedSeatSet.has(seat.id)) {
                    status = 'BOOKED';
                }
                else if (lockedSeatSet.has(seat.id)) {
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

            // RESPONSE
            return {
                id: showtime.id,
                movieId: showtime.movieId,
                screenId: showtime.screenId,
                startTime: showtime.startTime,
                endTime: showtime.endTime,
                basePrice: showtime.basePrice,
                status: showtime.status,
                createdAt: showtime.createdAt,
                updatedAt: showtime.updatedAt,

                movie: showtime.movie,

                screen: {
                    id: showtime.screen.id,
                    name: showtime.screen.name,
                    type: showtime.screen.type,

                    theater: showtime.screen.theater,

                    seats,
                },
            };
        } catch (error) {
            this.logger.error(
                'Failed to fetch showtime',
                error instanceof Error ? error.stack : String(error),
            );

            if (error instanceof NotFoundException) throw error;

            throw new InternalServerErrorException(
                'Failed to fetch showtime',
            );
        }
    }


    async findByMovie(movieId: string) {
        try {
            return await this.prisma.showtime.findMany({
                where: { movieId },
                include: {
                    screen: {
                        include: {
                            theater: true,
                        },
                    },
                },
                orderBy: {
                    startTime: 'asc',
                },
            });
        } catch (error) {
            this.logger.error(
                'Failed to fetch movie showtimes',
                error?.stack,
            );

            throw new InternalServerErrorException(
                'Failed to fetch movie showtimes',
            );
        }
    }

    async findByScreen(screenId: string) {
        try {
            return await this.prisma.showtime.findMany({
                where: { screenId },
                include: {
                    movie: true,
                },
                orderBy: {
                    startTime: 'asc',
                },
            });
        } catch (error) {
            this.logger.error(
                'Failed to fetch screen showtimes',
                error?.stack,
            );

            throw new InternalServerErrorException(
                'Failed to fetch screen showtimes',
            );
        }
    }

    async update(id: string, dto: UpdateShowtimeDto,) {
        try {
            await this.findOne(id);

            return await this.prisma.showtime.update({
                where: { id },
                data: dto,
                include: {
                    movie: true,
                    screen: true,
                },
            });
        } catch (error) {
            this.logger.error(
                'Failed to update showtime',
                error?.stack,
            );

            if (
                error instanceof NotFoundException
            ) {
                throw error;
            }

            throw new InternalServerErrorException(
                'Failed to update showtime',
            );
        }
    }

    async updateStatus(id: string, status: ShowtimeStatus,) {
        try {
            await this.findOne(id);

            return await this.prisma.showtime.update({
                where: { id },
                data: { status },
            });
        } catch (error) {
            this.logger.error(
                'Failed to update showtime status',
                error?.stack,
            );

            if (
                error instanceof NotFoundException
            ) {
                throw error;
            }

            throw new InternalServerErrorException(
                'Failed to update showtime status',
            );
        }
    }

    async remove(id: string) {
        try {
            await this.findOne(id);

            return await this.prisma.showtime.delete({
                where: { id },
            });
        } catch (error) {
            this.logger.error(
                'Failed to delete showtime',
                error?.stack,
            );

            if (
                error instanceof NotFoundException
            ) {
                throw error;
            }

            throw new InternalServerErrorException(
                'Failed to delete showtime',
            );
        }
    }
}
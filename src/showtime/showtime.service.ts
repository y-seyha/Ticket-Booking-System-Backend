/* eslint-disable */
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
import { MovieStatus, ShowtimeStatus } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateBulkScheduleDto } from './dto/create-bulk-showtime.dto';

@Injectable()
export class ShowtimeService {
  private readonly logger = new Logger(ShowtimeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateShowtimeDto) {
    try {
      const movie = await this.prisma.movie.findUnique({
        where: { id: dto.movieId },
      });

      if (!movie) {
        throw new NotFoundException('Movie not found');
      }

      const screen = await this.prisma.screen.findUnique({
        where: { id: dto.screenId },
      });

      if (!screen) {
        throw new NotFoundException('Screen not found');
      }

      const startTime = new Date(dto.startTime);
      const endTime = new Date(dto.endTime);

      if (startTime >= endTime) {
        throw new BadRequestException('End time must be after start time');
      }

      const overlap = await this.prisma.showtime.findFirst({
        where: {
          screenId: dto.screenId,
          status: ShowtimeStatus.SCHEDULED,
          AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
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
      this.logger.error('Failed to create showtime', error?.stack);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create showtime');
    }
  }

  async createBulkSchedule(dto: CreateBulkScheduleDto) {
    try {
      const movie = await this.prisma.movie.findUnique({
        where: { id: dto.movieId },
      });
      if (!movie) throw new NotFoundException('Movie not found');

      const buffer = dto.cleaningBufferMinutes ?? 15;

      const slotsToCreate: Array<{
        movieId: string;
        screenId: string;
        startTime: Date;
        endTime: Date;
        basePrice: number;
        status: ShowtimeStatus;
      }> = [];

      const executionSummaryItems: Array<{
        id: string;
        date: string;
        slot: string;
        theater: string;
        screen: string;
      }> = [];

      const now = new Date();

      for (const rawDate of dto.targetDates) {
        const [year, month, day] = rawDate.split('-').map(Number);

        if (isNaN(year) || isNaN(month) || isNaN(day)) {
          throw new BadRequestException(`Invalid date item parsed: ${rawDate}`);
        }

        for (const screenId of dto.screenIds) {
          const screen = await this.prisma.screen.findUnique({
            where: { id: screenId },
            include: { theater: true },
          });
          if (!screen) continue;

          for (const slot of dto.dailySlots) {
            const [hours, minutes] = slot.split(':').map(Number);

            const localStart = new Date(
              Date.UTC(year, month - 1, day, hours, minutes, 0, 0),
            );
            localStart.setUTCHours(localStart.getUTCHours() - 7);

            // Skip past slots quietly, or throw an error if you want to block past scheduling too
            if (localStart < now) {
              continue;
            }

            const actualMovieEnd = new Date(
              localStart.getTime() + movie.durationMinutes * 60000,
            );

            const conflictThresholdEnd = new Date(
              actualMovieEnd.getTime() + buffer * 60000,
            );

            // Collision overlap validation check
            const conflict = await this.prisma.showtime.findFirst({
              where: {
                screenId: screenId,
                status: ShowtimeStatus.SCHEDULED,
                AND: [
                  { startTime: { lt: conflictThresholdEnd } },
                  { endTime: { gt: localStart } },
                ],
              },
              include: {
                movie: { select: { title: true } },
              },
            });

           if (conflict) {
              throw new BadRequestException({
                error: 'Schedule Conflict Detected',
                message: `Cannot schedule "${movie.title}" at ${slot} on ${rawDate} inside ${screen.theater.name} (${screen.name}). This slot conflicts with an existing screening of "${conflict.movie.title}".`,
              });
            }

            // Queue for database insertion if this slot is safe
            slotsToCreate.push({
              movieId: dto.movieId,
              screenId: screenId,
              startTime: localStart,
              endTime: actualMovieEnd,
              basePrice: dto.basePrice,
              status: ShowtimeStatus.SCHEDULED,
            });
          }
        }
      }

      if (slotsToCreate.length === 0) {
        throw new BadRequestException(
          'No valid upcoming time slots were generated.',
        );
      }

      const createdItems = await this.prisma.$transaction(
        slotsToCreate.map((data) =>
          this.prisma.showtime.create({
            data,
            include: { screen: { include: { theater: true } } },
          }),
        ),
      );

      for (let i = 0; i < createdItems.length; i++) {
        const item = createdItems[i];
        const matchingDateString =
          dto.targetDates[
            Math.floor(i / (dto.screenIds.length * dto.dailySlots.length))
          ];

        executionSummaryItems.push({
          id: item.id,
          date: item.startTime.toISOString().split('T')[0], // format date boundary
          slot: dto.dailySlots[i % dto.dailySlots.length],
          theater: item.screen.theater.name,
          screen: item.screen.name,
        });
      }

      return {
        message:
          'Bulk configuration grid generation processing executed fully.',
        summary: {
          created: createdItems.length,
          skippedConflicts: 0,
          items: executionSummaryItems,
        },
      };
    } catch (error) {
      this.logger.error(
        'Failed executing multi-dimensional showtime bulk generation grid array processing sequence',
        error?.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new InternalServerErrorException(
        'Failed processing bulk scheduling matrix layout configurations',
      );
    }
  }

  async findAll() {
    try {
      return await this.prisma.showtime.findMany({
        include: {
          movie: true,
          screen: { include: { theater: true } },
        },
        orderBy: { startTime: 'asc' },
      });
    } catch (error) {
      this.logger.error('Failed to fetch showtimes', error?.stack);
      throw new InternalServerErrorException('Failed to fetch showtimes');
    }
  }

  async findOne(id: string) {
    try {
      const now = new Date();

      const [showtime, pricing, seatLocks, bookingSeats] = await Promise.all([
        this.prisma.showtime.findUnique({
          where: { id },
          include: {
            movie: { include: { poster: true } },
            screen: {
              include: {
                theater: true,
                seats: true,
                template: {
                  include: {
                    layouts: {
                      include: {
                        seats: true,
                      },
                    },
                  },
                },
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
          select: { seatId: true },
        }),
        this.prisma.bookingSeat.findMany({
          where: { showtimeId: id },
          select: { seatId: true },
        }),
      ]);

      if (!showtime) {
        throw new NotFoundException('Showtime not found');
      }

      const pricingMap = Object.fromEntries(
        pricing.map((p) => [p.seatType, Number(p.seatSurcharge)]),
      );

      const lockedSeatSet = new Set(seatLocks.map((l) => l.seatId));
      const bookedSeatSet = new Set(bookingSeats.map((b) => b.seatId));

      const dynamicPhysicalSeatsMap = new Map(
        showtime.screen.seats.map((seat) => {
          let status: 'AVAILABLE' | 'LOCKED' | 'BOOKED' = 'AVAILABLE';
          if (bookedSeatSet.has(seat.id)) {
            status = 'BOOKED';
          } else if (lockedSeatSet.has(seat.id)) {
            status = 'LOCKED';
          }

          return [
            `${seat.seatRow}-${seat.seatNumber}`,
            {
              id: seat.id,
              status,
              surcharge: pricingMap[seat.seatType] ?? 0,
            },
          ];
        }),
      );

      const structuredLayouts = showtime.screen.template.layouts.map(
        (layout) => ({
          id: layout.id,
          name: layout.name,
          seats: layout.seats.map((templateSeat) => {
            const matchKey = `${templateSeat.seatRow}-${templateSeat.seatNumber}`;
            const physicalSeatDetails = dynamicPhysicalSeatsMap.get(matchKey);

            return {
              id: physicalSeatDetails?.id || templateSeat.id,
              seatRow: templateSeat.seatRow,
              seatNumber: templateSeat.seatNumber,
              posX: templateSeat.posX,
              posY: templateSeat.posY,
              seatType: templateSeat.seatType,
              status: physicalSeatDetails?.status || 'AVAILABLE',
              surcharge: physicalSeatDetails?.surcharge || 0,
            };
          }),
        }),
      );

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
        movie: {
          ...showtime.movie,
          poster: showtime.movie.poster?.url || null,
        },
        screen: {
          id: showtime.screen.id,
          name: showtime.screen.name,
          type: showtime.screen.type,
          theater: showtime.screen.theater,
          screenTemplate: {
            id: showtime.screen.template.id,
            name: showtime.screen.template.name,
            screenSurcharge: showtime.screen.template.screenSurcharge,
            layouts: structuredLayouts,
          },
        },
      };
    } catch (error) {
      this.logger.error(
        'Failed to fetch showtime',
        error instanceof Error ? error.stack : String(error),
      );
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to fetch showtime');
    }
  }

  async findByMovie(movieId: string) {
    try {
      return await this.prisma.showtime.findMany({
        where: { movieId },
        include: {
          movie: true,
          screen: { include: { theater: true } },
        },
        orderBy: { startTime: 'asc' },
      });
    } catch (error) {
      this.logger.error('Failed to fetch movie showtimes', error?.stack);
      throw new InternalServerErrorException('Failed to fetch movie showtimes');
    }
  }

  async findByScreen(screenId: string) {
    try {
      return await this.prisma.showtime.findMany({
        where: { screenId },
        include: { movie: true },
        orderBy: { startTime: 'asc' },
      });
    } catch (error) {
      this.logger.error('Failed to fetch screen showtimes', error?.stack);
      throw new InternalServerErrorException(
        'Failed to fetch screen showtimes',
      );
    }
  }

  async update(id: string, dto: UpdateShowtimeDto) {
    try {
      await this.findOne(id);
      return await this.prisma.showtime.update({
        where: { id },
        data: dto,
        include: { movie: true, screen: true },
      });
    } catch (error) {
      this.logger.error('Failed to update showtime', error?.stack);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to update showtime');
    }
  }

  async updateStatus(id: string, status: ShowtimeStatus) {
    try {
      await this.findOne(id);
      const targetStatus =
        (status as string) === 'ACTIVE' ? ShowtimeStatus.SCHEDULED : status;

      return await this.prisma.showtime.update({
        where: { id },
        data: { status: targetStatus },
      });
    } catch (error) {
      this.logger.error('Failed to update showtime status', error?.stack);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to update showtime status',
      );
    }
  }

  async remove(id: string) {
    try {
      await this.findOne(id);

      return await this.prisma.showtime.update({
        where: { id },
        data: { status: ShowtimeStatus.CANCELLED },
      });
    } catch (error) {
      this.logger.error(
        'Failed to cancel showtime listing instance',
        error?.stack,
      );
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to cancel showtime listing instance',
      );
    }
  }

  async findActiveListings(status: MovieStatus, dateStr: string) {
    try {
      if (!status || !dateStr) {
        throw new BadRequestException(
          'Status and date query parameters are required',
        );
      }

      let year: number;
      let month: number;
      let day: number;

      // Explicitly check for the 'YYYY-MM-DD' format first to prevent Date.parse() hijacking
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-').map(Number);
        year = y;
        month = m;
        day = d;
      }
      //  Fallback to ISO/UTC parsing only if the format isn't simple YYYY-MM-DD
      else if (dateStr.includes('T') || !isNaN(Date.parse(dateStr))) {
        const utcDate = new Date(dateStr);
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Phnom_Penh',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
        });
        const parts = formatter.formatToParts(utcDate);
        year = Number(parts.find((p) => p.type === 'year')?.value);
        month = Number(parts.find((p) => p.type === 'month')?.value);
        day = Number(parts.find((p) => p.type === 'day')?.value);
      } else {
        throw new BadRequestException('Invalid date format provided');
      }

      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        throw new BadRequestException('Invalid date fields parsed');
      }

      //  Set precise boundaries using local hours adjustment
      // Using UTC date and subtracting 7 hours ensures full day coverage (00:00:00 to 23:59:59 local)
      const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      startOfDay.setHours(startOfDay.getHours() - 7);

      const endOfDay = new Date(
        Date.UTC(year, month - 1, day, 23, 59, 59, 999),
      );
      endOfDay.setHours(endOfDay.getHours() - 7);

      const isComingSoon = status === MovieStatus.COMING_SOON;

      const timeCondition = isComingSoon
        ? { startTime: { gte: startOfDay } }
        : {
            startTime: {
              gte: startOfDay,
              lte: endOfDay,
            },
          };

      const moviesWithShowtimes = await this.prisma.movie.findMany({
        where: {
          status: status,
          showtimes: {
            some: {
              status: ShowtimeStatus.SCHEDULED,
              ...timeCondition,
            },
          },
        },
        include: {
          poster: true,
          showtimes: {
            where: {
              status: ShowtimeStatus.SCHEDULED,
              ...timeCondition,
            },
            include: {
              screen: {
                select: {
                  name: true,
                  type: true,
                  theater: true,
                },
              },
            },
            orderBy: { startTime: 'asc' },
          },
        },
      });

      return moviesWithShowtimes.map((movie) => ({
        id: movie.id,
        title: movie.title,
        description: movie.description,
        durationMinutes: movie.durationMinutes,
        language: movie.language,
        releaseDate: movie.releaseDate,
        poster: movie.poster?.url || '/fallback-poster.jpg',
        trailerYoutubeId: movie.trailerYoutubeId,
        showtimes: movie.showtimes.map((st) => ({
          id: st.id,
          startTime: st.startTime,
          endTime: st.endTime,
          basePrice: st.basePrice,
          screenName: st.screen.name,
          screenType: st.screen.type,
          theaterName: st.screen.theater.name,
          theaterLocation: st.screen.theater.location,
          theaterCity: st.screen.theater.city,
        })),
      }));
    } catch (error) {
      this.logger.error(
        'Failed to fetch filtered active listings',
        error?.stack,
      );
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch filtered active listings',
      );
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handlePastShowtimes() {
    try {
      const now = new Date();

      const updateResult = await this.prisma.showtime.updateMany({
        where: {
          status: ShowtimeStatus.SCHEDULED,
          endTime: {
            lt: now,
          },
        },
        data: {
          status: ShowtimeStatus.FINISHED,
        },
      });

      if (updateResult.count > 0) {
        this.logger.log(
          `Successfully marked ${updateResult.count} past showtime instances as FINISHED.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to execute past showtimes cron optimization cycle',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

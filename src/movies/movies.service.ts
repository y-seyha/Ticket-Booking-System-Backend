/* eslint-disable */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Movie, MovieStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { MovieQueryDto } from './dto/ movie-query.dto';
import { FileUploadService } from '../file-upload/file-upload.service';
import { UploadFolder } from '../file-upload/dto/upload-file.dto';
import { File } from '@prisma/client';
import { toZonedTime } from 'date-fns-tz';

@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  async create(
    dto: CreateMovieDto,
    file?: Express.Multer.File,
    userId?: string,
  ): Promise<Movie> {
    try {
      this.logger.log(`Creating movie: ${dto.title}`);

      let posterFile: File | null = null;

      if (file) {
        posterFile = await this.fileUploadService.uploadFile(
          file,
          { folder: UploadFolder.MOVIES, description: dto.title },
          userId,
        );
      }

      const movie = await this.prisma.movie.create({
        data: {
          ...dto,
          status: this.computeStatus(dto.releaseDate),
          posterId: posterFile?.id,
        },
        include: {
          poster: true,
        },
      });
      this.logger.log({
        releaseDate: dto.releaseDate,
        now: new Date(),
      });

      return movie;
    } catch (error) {
      this.logger.error('Failed to create movie', error?.stack);
      throw error;
    }
  }

  async findAll(query: MovieQueryDto) {
    try {
      const { page = 1, limit = 10, search, status, month } = query;

      const skip = (page - 1) * limit;

      const where: Prisma.MovieWhereInput = {
        ...(status && {
          status,
        }),

        ...(search && {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        }),
      };

      if (month) {
       const [yearStr, monthStr] = month.split('-');
        const year = parseInt(yearStr, 10);
        const monthIndex = parseInt(monthStr, 10) - 1;

        if (!isNaN(year) && !isNaN(monthIndex)) {
          // First millisecond of the selected month
          const startDate = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
          // First millisecond of the following month
          const endDate = new Date(
            Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0),
          );

          where.releaseDate = {
            gte: startDate,
            lt: endDate,
          };
        }
      }

      const [movies, total] = await this.prisma.$transaction([
        this.prisma.movie.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            releaseDate: 'asc',
          },
          include: {
            poster: true,
          },
        }),

        this.prisma.movie.count({
          where,
        }),
      ]);

      return {
        data: movies,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch movies', error?.stack);
      throw new InternalServerErrorException('Failed to fetch movies');
    }
  }

  async findOne(id: string, date?: string) {
    try {
      const showtimeDateFilter: Prisma.ShowtimeWhereInput = {
        status: 'SCHEDULED',
      };

      if (date) {
        let year: number;
        let month: number;
        let day: number;

        // Check if incoming string is an ISO format timestamp or plain date
        if (date.includes('T') || !isNaN(Date.parse(date))) {
          const utcDate = new Date(date);

          // Forcefully parse date string parts into Cambodia Local components
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
          // Fallback parsing for raw "YYYY-MM-DD" structures
          const [y, m, d] = date.split('-').map(Number);
          year = y;
          month = m;
          day = d;
        }

        if (isNaN(year) || isNaN(month) || isNaN(day)) {
          throw new BadRequestException('Invalid date format provided');
        }

        // Construct clean UTC bounds representing the start and end of Cambodia local days
        const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        startOfDay.setUTCHours(startOfDay.getUTCHours() - 7); // Shift to Cambodia offset (UTC+7)

        const endOfDay = new Date(
          Date.UTC(year, month - 1, day, 23, 59, 59, 999),
        );
        endOfDay.setUTCHours(endOfDay.getUTCHours() - 7); // Shift to Cambodia offset (UTC+7)

        showtimeDateFilter.startTime = {
          gte: startOfDay,
          lte: endOfDay,
        };
      }

      const movie = await this.prisma.movie.findUnique({
        where: { id },
        include: {
          poster: true,
          showtimes: {
            where: showtimeDateFilter,
            include: {
              screen: {
                include: {
                  theater: {
                    include: {
                      image: true,
                    },
                  },
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
          },
        },
      });

      if (!movie) {
        throw new NotFoundException('Movie not found');
      }

      if (movie.showtimes) {
        movie.showtimes.sort(
          (a, b) => a.startTime.getTime() - b.startTime.getTime(),
        );
      }

      return this.transformMovieResponse(movie);
    } catch (error) {
      this.logger.error(`Failed to fetch movie ${id}`, error?.stack);
      throw error;
    }
  }

  private transformMovieResponse(movie: any) {
    const locationsMap = new Map();

    movie.showtimes.forEach((showtime: any) => {
      const theater = showtime.screen.theater;
      if (!locationsMap.has(theater.id)) {
        locationsMap.set(theater.id, {
          id: theater.id,
          name: theater.name,
          location: theater.location,
          city: theater.city,
          showtimes: [],
        });
      }

      locationsMap.get(theater.id).showtimes.push({
        id: showtime.id,
        startTime: showtime.startTime,
        endTime: showtime.endTime,
        screenName: showtime.screen.name,
        screenType: showtime.screen.type,
        basePrice: showtime.basePrice,
        screenTemplate: {
          id: showtime.screen.template.id,
          name: showtime.screen.template.name,
          screenSurcharge: showtime.screen.template.screenSurcharge,
          layouts: showtime.screen.template.layouts.map((layout: any) => ({
            id: layout.id,
            name: layout.name,
            seats: layout.seats.map((ts: any) => ({
              id: ts.id,
              seatRow: ts.seatRow,
              seatNumber: ts.seatNumber,
              posX: ts.posX,
              posY: ts.posY,
              seatType: ts.seatType,
            })),
          })),
        },
      });
    });

    return {
      id: movie.id,
      title: movie.title,
      description: movie.description,
      durationMinutes: movie.durationMinutes,
      language: movie.language,
      releaseDate: movie.releaseDate,
      poster: movie.poster?.url || null,
      backdrop: movie.poster?.url || null,
      trailerYoutubeId: movie.trailerYoutubeId || null,
      showtimesByLocation: Array.from(locationsMap.values()),
    };
  }

  async update(
    id: string,
    dto: UpdateMovieDto,
    file?: Express.Multer.File,
    userId?: string,
  ) {
    try {
      const movie = await this.prisma.movie.findUnique({
        where: { id },
        include: { poster: true },
      });

      if (!movie) {
        throw new NotFoundException('Movie not found');
      }

      let posterFile: File | null = null;

      // if new file uploaded → delete old one first
      if (file) {
        if (movie.poster) {
          await this.fileUploadService['cloudinary'].deleteFile(
            movie.poster.publicId,
          );

          await this.prisma.file.delete({
            where: { id: movie.poster.id },
          });
        }

        // upload new poster
        posterFile = await this.fileUploadService.uploadFile(
          file,
          {
            folder: UploadFolder.MOVIES,
            description: dto.title ?? 'movie poster',
          },
          userId,
        );
      }

      const updatedReleaseDate = dto.releaseDate ?? movie.releaseDate;

      return this.prisma.movie.update({
        where: { id },
        data: {
          ...dto,
          status: this.computeStatus(updatedReleaseDate),
          ...(posterFile && { posterId: posterFile.id }),
        },
        include: {
          poster: true,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update movie ${id}`, error?.stack);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      const movie = await this.prisma.movie.findUnique({
        where: { id },
        include: { poster: true },
      });

      if (!movie) {
        throw new NotFoundException('Movie not found');
      }

      if (movie.posterId) {
        const file = await this.prisma.file.findUnique({
          where: { id: movie.posterId },
        });

        if (file) {
          // delete from cloudinary directly via injected service
          await this.fileUploadService['cloudinary'].deleteFile(file.publicId);

          await this.prisma.file.delete({
            where: { id: file.id },
          });
        }
      }
      await this.prisma.movie.delete({
        where: { id },
      });

      this.logger.log(`Movie deleted successfully: ${id}`);

      return {
        success: true,
        message: 'Movie deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete movie ${id}`, error?.stack);
      throw error;
    }
  }

  async updateStatus(id: string, status: MovieStatus) {
    try {
      const movie = await this.prisma.movie.findUnique({
        where: { id },
      });

      if (!movie) {
        throw new NotFoundException('Movie not found');
      }

      const now = new Date();
      const releaseDate = new Date(movie.releaseDate);

      now.setHours(0, 0, 0, 0);
      releaseDate.setHours(0, 0, 0, 0);

      //cannot set COMING_SOON after release date
      if (status === MovieStatus.COMING_SOON && releaseDate <= now) {
        throw new BadRequestException(
          'Cannot set COMING_SOON for released movies',
        );
      }

      //  cannot set NOW_SHOWING before release date
      if (status === MovieStatus.NOW_SHOWING && releaseDate > now) {
        throw new BadRequestException(
          'Cannot set NOW_SHOWING before release date',
        );
      }

      return await this.prisma.movie.update({
        where: { id },
        data: { status },
      });
    } catch (error) {
      this.logger.error(`Failed to update movie status ${id}`, error?.stack);
      throw error;
    }
  }

  private computeStatus(releaseDate: Date): MovieStatus {
    const timeZone = 'Asia/Phnom_Penh';

    const now = toZonedTime(new Date(), timeZone);
    const release = toZonedTime(releaseDate, timeZone);

    now.setHours(0, 0, 0, 0);
    release.setHours(0, 0, 0, 0);

    return release > now ? MovieStatus.COMING_SOON : MovieStatus.NOW_SHOWING;
  }
}

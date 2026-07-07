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
      const { page = 1, limit = 10, search, status } = query;

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

      const [movies, total] = await this.prisma.$transaction([
        this.prisma.movie.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            createdAt: 'desc',
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

  async findOne(id: string) {
    try {
      const movie = await this.prisma.movie.findUnique({
        where: { id },
        include: {
          poster: true,
          showtimes: {
            where: {
              status: 'SCHEDULED',
            },
            include: {
              screen: {
                include: {
                  theater: {
                    include: {
                      image: true
                    }
                  }
                }
              }
            },
            orderBy: {
              startTime: 'asc',
            }
          },
        },
      });

      if (!movie) {
        throw new NotFoundException('Movie not found');
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
      trailerYoutubeId: movie.trailerYoutubeId || null, // Added this line
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

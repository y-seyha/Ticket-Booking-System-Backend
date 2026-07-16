/* eslint-disable */
import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTheaterDto } from './dto/create-theater.dto';
import { UpdateTheaterDto } from './dto/update-theater.dto';
import { TheaterQueryDto } from './dto/theater-query.dto';
import { Theater } from '@prisma/client';
import { FileUploadService } from '../file-upload/file-upload.service';
import { UploadFolder } from '../file-upload/dto/upload-file.dto';
import { File } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { SearchService } from '../search/search.service';

@Injectable()
export class TheaterService {
  private readonly logger = new Logger(TheaterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileUploadService: FileUploadService,
    private readonly searchService: SearchService,
  ) {}

  async create(
    dto: CreateTheaterDto,
    file?: Express.Multer.File,
    userId?: string,
  ) {
    try {
      this.logger.log(`Creating theater: ${dto.name}`);

      let imageFile: File | null = null;

      if (file) {
        imageFile = await this.fileUploadService.uploadFile(
          file,
          {
            folder: UploadFolder.THEATERS,
            description: dto.name,
          },
          userId,
        );
      }

      const theater = await this.prisma.theater.create({
        data: {
          ...dto,
          imageId: imageFile?.id,
        },
        include: {
          image: true,
        },
      });

      await this.searchService.indexTheater(theater);

      return theater;
    } catch (error) {
      this.logger.error('Failed to create theater', error?.stack);
      throw new InternalServerErrorException('Failed to create theater');
    }
  }

  async findAll(query: TheaterQueryDto) {
    try {
      const { page = 1, limit = 10, search, status } = query;

      const skip = (page - 1) * limit;

      const where: Prisma.TheaterWhereInput = {
        ...(status && { status }),
        ...(search && {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        }),
      };

      const [data, total] = await this.prisma.$transaction([
        this.prisma.theater.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            screens: true,
            image: true,
          },
        }),
        this.prisma.theater.count({ where }),
      ]);

      return {
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch theaters', (error as Error).stack);
      throw new InternalServerErrorException('Failed to fetch theaters');
    }
  }

  async findOne(id: string): Promise<Theater> {
    try {
      const theater = await this.prisma.theater.findUnique({
        where: { id },
        include: { screens: true , image : true},
      });

      if (!theater) {
        throw new NotFoundException('Theater not found');
      }

      return theater;
    } catch (error) {
      this.logger.error(
        `Failed to fetch theater ${id}`,
        (error as Error).stack,
      );

      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException('Failed to fetch theater');
    }
  }

  async update(
    id: string,
    dto: UpdateTheaterDto,
    file?: Express.Multer.File,
    userId?: string,
  ) {
    try {
      const theater = await this.prisma.theater.findUnique({
        where: { id },
        include: { image: true },
      });

      if (!theater) {
        throw new NotFoundException('Theater not found');
      }

      let newImage: any = null;

      if (file) {
        newImage = await this.fileUploadService.uploadFile(
          file,
          {
            folder: UploadFolder.THEATERS,
            description: dto.name ?? theater.name,
          },
          userId,
        );

        if (theater.imageId && theater.image) {
          await this.fileUploadService['cloudinary'].deleteFile(
            theater.image.publicId,
          );

          await this.prisma.file.delete({
            where: { id: theater.imageId },
          });
        }
      }

      const updated = await this.prisma.theater.update({
        where: { id },
        data: {
          name: dto.name,
          phone: dto.phone,
          email: dto.email,
          location: dto.location,
          city: dto.city,
          status: dto.status,
          ...(newImage && { imageId: newImage.id }),
        },
        include: {
          image: true,
        },
      });

      await this.searchService.indexTheater(updated);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update theater ${id}`, error?.stack);

      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException('Failed to update theater');
    }
  }

  async remove(id: string) {
    try {
      const theater = await this.prisma.theater.findUnique({
        where: { id },
        include: { image: true, screens: true },
      });

      if (!theater) {
        throw new NotFoundException('Theater not found');
      }

      if (theater.screens.length > 0) {
        throw new BadRequestException(
          'Cannot delete theater with existing screens',
        );
      }

      // delete image first
      if (theater.imageId && theater.image) {
        await this.fileUploadService['cloudinary'].deleteFile(
          theater.image.publicId,
        );

        await this.prisma.file.delete({
          where: { id: theater.imageId },
        });
      }

      await this.prisma.theater.delete({
        where: { id },
      });

      await this.searchService.removeTheater(id);

      this.logger.log(`Theater deleted: ${id}`);

      return {
        success: true,
        message: 'Theater deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete theater ${id}`, error?.stack);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to delete theater');
    }
  }

  async findMoviesByTheaterAndDate(theaterId: string, date?: string) {
    try {
      const showtimeFilter: Prisma.ShowtimeWhereInput = {
        status: 'SCHEDULED',
        screen: {
          theaterId: theaterId,
        },
      };

      if (date) {
        let year: number;
        let month: number;
        let day: number;

        if (date.includes('T') || !isNaN(Date.parse(date))) {
          const utcDate = new Date(date);
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
          const [y, m, d] = date.split('-').map(Number);
          year = y;
          month = m;
          day = d;
        }

        if (isNaN(year) || isNaN(month) || isNaN(day)) {
          throw new BadRequestException('Invalid date format provided');
        }

        const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        startOfDay.setUTCHours(startOfDay.getUTCHours() - 7);

        const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
        endOfDay.setUTCHours(endOfDay.getUTCHours() - 7);

        showtimeFilter.startTime = {
          gte: startOfDay,
          lte: endOfDay,
        };
      }

      const showtimes = await this.prisma.showtime.findMany({
        where: showtimeFilter,
        include: {
          movie: {
            include: { poster: true },
          },
          screen: {
            include: { theater: true },
          },
        },
        orderBy: { startTime: 'asc' },
      });

       const moviesMap = new Map<string, any>();

      showtimes.forEach((st) => {
        if (!st.movie) return;

        if (!moviesMap.has(st.movieId)) {
          moviesMap.set(st.movieId, {
            id: st.movie.id,
            title: st.movie.title,
            ageRating: (st.movie as any).ageRating || 'G',
            duration: (st.movie as any).duration || 0,
            poster: st.movie.poster?.url || null, // Resolves poster URL just like findOne()
            showtimes: [],
          });
        }

        moviesMap.get(st.movieId).showtimes.push({
          id: st.id,
          startTime: st.startTime,
          endTime: st.endTime,
          basePrice: st.basePrice,
          status: st.status,
          screen: {
            id: st.screen.id,
            name: st.screen.name,
            type: st.screen.type,
          },
        });
      });

      return {
        data: Array.from(moviesMap.values()),
      };
    } catch (error) {
      this.logger.error(`Failed to load movie schedule for theater ${theaterId}`, error?.stack);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to process theater details');
    }
  }
}

import {Injectable, InternalServerErrorException, Logger, NotFoundException,} from '@nestjs/common';
import {Movie, Prisma} from '@prisma/client';
import {PrismaService} from '../prisma/prisma.service';
import {CreateMovieDto} from './dto/create-movie.dto';
import {UpdateMovieDto} from './dto/update-movie.dto';
import {MovieQueryDto} from "./dto/ movie-query.dto";
import {FileUploadService} from "../file-upload/file-upload.service";
import {UploadFolder} from "../file-upload/dto/upload-file.dto";
import { File } from '@prisma/client';


@Injectable()
export class MoviesService {
    private readonly logger = new Logger(MoviesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly fileUploadService: FileUploadService,
    ) {}

    async create(dto: CreateMovieDto, file?: Express.Multer.File, userId?: string ): Promise<Movie> {
        try {
            this.logger.log(`Creating movie: ${dto.title}`);

            let posterFile: File | null = null;

            if (file) {
                posterFile = await this.fileUploadService.uploadFile(
                    file,
                    { folder: UploadFolder.MOVIES, description: dto.title }, userId,
                );
            }

            const movie = await this.prisma.movie.create({
                data: {
                    ...dto,
                    posterId: posterFile?.id,
                },
                include: {
                    poster: true,
                },
            });

            return movie;
        } catch (error) {
            this.logger.error('Failed to create movie', error?.stack);
            throw error;
        }
    }

    async findAll(query: MovieQueryDto) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                status,
            } = query;

            const skip =
                (page - 1) * limit;

            const where: Prisma.MovieWhereInput =
                {
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

            const [movies, total] =
                await this.prisma.$transaction([
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

                    totalPages:
                        Math.ceil(
                            total / limit,
                        ),
                },
            };
        } catch (error) {
            this.logger.error(
                'Failed to fetch movies',
                error?.stack,
            );

            throw new InternalServerErrorException(
                'Failed to fetch movies',
            );
        }
    }

    async findOne(id: string) {
        try {
            const movie =
                await this.prisma.movie.findUnique({
                    where: {
                        id,
                    },
                    include: {
                        poster: true,
                        showtimes: true,
                    },
                });

            if (!movie) {
                throw new NotFoundException(
                    'Movie not found',
                );
            }

            return movie;
        } catch (error) {
            this.logger.error(
                `Failed to fetch movie ${id}`,
                error?.stack,
            );

            throw error;
        }
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

            return await this.prisma.movie.update({
                where: { id },
                data: {
                    ...dto,
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
}
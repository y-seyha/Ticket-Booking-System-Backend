import {
    Injectable,
    Logger,
    NotFoundException,
    InternalServerErrorException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { GenerateTemplateSeatsDto } from './dto/generate-template-seat.dto';

@Injectable()
export class SeatTemplateService {
    private readonly logger = new Logger(SeatTemplateService.name);

    constructor(private readonly prisma: PrismaService) {}

    private handleError(
        error: unknown,
        logMessage: string,
        userMessage = 'Internal server error',
    ): never {
        this.logger.error(
            logMessage,
            error instanceof Error ? error.stack : String(error),
        );

        if (
            error instanceof NotFoundException ||
            error instanceof BadRequestException
        ) {
            throw error;
        }

        throw new InternalServerErrorException(userMessage);
    }

    async findAll() {
        try {
            return await this.prisma.screenTemplateSeat.findMany({
                include: {
                    template: true,
                },
            });
        } catch (error) {
            this.handleError(
                error,
                'Fetch template seats failed',
                'Failed to fetch template seats',
            );
        }
    }

    async findOne(id: string) {
        try {
            const seat = await this.prisma.screenTemplateSeat.findUnique({
                where: { id },
                include: {
                    template: true,
                },
            });

            if (!seat) {
                throw new NotFoundException('Template seat not found');
            }

            return seat;
        } catch (error) {
            this.handleError(
                error,
                `Fetch seat ${id} failed`,
                'Failed to fetch template seat',
            );
        }
    }

    async findByTemplate(templateId: string) {
        try {
            const template = await this.prisma.screenTemplate.findUnique({
                where: { id: templateId },
            });

            if (!template) {
                throw new NotFoundException('Screen template not found');
            }

            return await this.prisma.screenTemplateSeat.findMany({
                where: { templateId },
                orderBy: [{ posY: 'asc' }, { posX: 'asc' }],
            });
        } catch (error) {
            this.handleError(
                error,
                `Fetch seats for template ${templateId} failed`,
                'Failed to fetch template seats',
            );
        }
    }

    async generateBulk(dto: GenerateTemplateSeatsDto) {
        try {
            const template = await this.prisma.screenTemplate.findUnique({
                where: { id: dto.templateId },
            });

            if (!template) {
                throw new NotFoundException('Screen template not found');
            }

            if (!dto.seatMap?.length) {
                throw new BadRequestException(
                    'Seat map must contain at least one row',
                );
            }

            if (dto.seatsPerRow <= 0) {
                throw new BadRequestException(
                    'Seats per row must be greater than 0',
                );
            }

            this.logger.log(
                `Generating seats for template=${dto.templateId}`,
            );

            const seats: Prisma.ScreenTemplateSeatCreateManyInput[] = [];

            for (const rowConfig of dto.seatMap) {
                for (let num = 1; num <= dto.seatsPerRow; num++) {
                    seats.push({
                        templateId: dto.templateId,
                        seatRow: rowConfig.row,
                        seatNumber: num,
                        posX: num,
                        posY: rowConfig.row.charCodeAt(0) - 64,
                        seatType: rowConfig.seatType,
                    });
                }
            }

            const result =
                await this.prisma.screenTemplateSeat.createMany({
                    data: seats,
                    skipDuplicates: true,
                });

            this.logger.log(
                `Created ${result.count} template seats`,
            );

            return {
                message: 'Template seats generated successfully',
                total: result.count,
            };
        } catch (error) {
            this.handleError(
                error,
                'Bulk seat generation failed',
                'Failed to generate template seats',
            );
        }
    }
}
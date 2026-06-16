import {
    Injectable,
    Logger,
    NotFoundException,
    InternalServerErrorException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScreenDto } from './dto/create-screen.dto';
import { UpdateScreenDto } from './dto/update-screen.dto';
import { Prisma, SeatStatus, SeatType } from '@prisma/client';

type ScreenTemplateWithSeats = Prisma.ScreenTemplateGetPayload<{
    include: {
        templateSeats: true;
    };
}>;

@Injectable()
export class ScreenService {
    private readonly logger = new Logger(ScreenService.name);

    constructor(private readonly prisma: PrismaService) {}

    async create(dto: CreateScreenDto) {
        try {
            this.logger.log(
                `Creating screen for theater=${dto.theaterId}, template=${dto.templateId}`,
            );

            const theater = await this.prisma.theater.findUnique({
                where: { id: dto.theaterId },
            });

            if (!theater) {
                throw new NotFoundException('Theater not found');
            }

            const template = await this.prisma.screenTemplate.findUnique({
                where: { id: dto.templateId },
                include: {
                    templateSeats: true,
                },
            });

            if (!template) {
                throw new NotFoundException('Screen template not found');
            }

            if (template.type !== dto.type) {
                throw new BadRequestException(
                    `Screen type must match template type (${template.type})`,
                );
            }

            return await this.prisma.$transaction(async (tx) => {
                const screen = await tx.screen.create({
                    data: {
                        theaterId: dto.theaterId,
                        templateId: dto.templateId,
                        name: dto.name,
                        type: dto.type,
                    },
                });

                await this.generateSeats(tx, screen.id, template);

                this.logger.log(`Screen created: ${screen.id}`);

                return screen;
            });
        } catch (error) {
            this.logger.error('Failed to create screen', error.stack);

            if (
                error instanceof NotFoundException ||
                error instanceof BadRequestException
            ) {
                throw error;
            }

            throw new InternalServerErrorException('Failed to create screen');
        }
    }

    private async generateSeats(tx: Prisma.TransactionClient, screenId: string, template: ScreenTemplateWithSeats,) {
        if (!template.templateSeats || template.templateSeats.length === 0) {
            throw new BadRequestException(
                'Template has no seats defined',
            );
        }

        const seats: Prisma.SeatCreateManyInput[] = template.templateSeats.map(
            (tSeat) => ({
                screenId,
                seatRow: tSeat.seatRow,
                seatNumber: tSeat.seatNumber,
                posX: tSeat.posX,
                posY: tSeat.posY,
                seatType: tSeat.seatType as SeatType,
                status: SeatStatus.ACTIVE,
            }),
        );

        await tx.seat.createMany({
            data: seats,
        });

        this.logger.log(
            `Generated ${seats.length} seats for screen ${screenId}`,
        );
    }

    async findAll() {
        try {
            return await this.prisma.screen.findMany({
                include: {
                    theater: true,
                    template: true,
                    seats: true,
                },
            });
        } catch (error) {
            const err = error as Error;

            this.logger.error(
                'Failed to fetch screens',
                err?.stack || String(error),
            );

            throw new InternalServerErrorException();
        }
    }

    async findOne(id: string) {
        const screen = await this.prisma.screen.findUnique({
            where: { id },
            include: {
                theater: true,
                template: true,
                seats: true,
            },
        });

        if (!screen) {
            throw new NotFoundException('Screen not found');
        }

        return screen;
    }

    async update(id: string, dto: UpdateScreenDto) {
        try {
            await this.findOne(id);

            if (dto.templateId) {
                const template = await this.prisma.screenTemplate.findUnique({
                    where: { id: dto.templateId },
                });

                if (!template) {
                    throw new NotFoundException('Screen template not found');
                }

                if (dto.type && template.type !== dto.type) {
                    throw new BadRequestException(
                        `Screen type must match template type (${template.type})`,
                    );
                }
            }

            return await this.prisma.screen.update({
                where: { id },
                data: dto,
            });
        } catch (error) {
            this.logger.error(`Failed to update screen ${id}`, error.stack);

            if (
                error instanceof NotFoundException ||
                error instanceof BadRequestException
            ) {
                throw error;
            }

            throw new InternalServerErrorException('Failed to update screen');
        }
    }

    async remove(id: string) {
        try {
            await this.findOne(id);

            return await this.prisma.screen.delete({
                where: { id },
            });
        } catch (error) {
            this.logger.error(`Failed to delete screen ${id}`, error.stack);

            if (error instanceof NotFoundException) throw error;

            throw new InternalServerErrorException('Failed to delete screen');
        }
    }

}
import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeatPricingDto } from './dto/create-seat-pricing.dto';
import { UpdateSeatPricingDto } from './dto/update-seat-pricing.dto';
import {SeatType} from "@prisma/client";

@Injectable()
export class SeatPricingService {
    private readonly logger = new Logger(SeatPricingService.name);

    constructor(private readonly prisma: PrismaService) {}

    async create(dto: CreateSeatPricingDto) {
        try {
            const existing = await this.prisma.seatPricingRule.findUnique({
                where: { seatType: dto.seatType },
            });

            if (existing) {
                throw new BadRequestException(
                    `Seat pricing for ${dto.seatType} already exists`,
                );
            }

            const result = await this.prisma.seatPricingRule.create({
                data: {
                    seatType: dto.seatType,
                    seatSurcharge: dto.seatSurcharge,
                    isActive: dto.isActive ?? true,
                },
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to create seat pricing rule', error?.stack);

            if (error instanceof BadRequestException) throw error;

            throw new InternalServerErrorException(
                'Unexpected error while creating seat pricing rule',
            );
        }
    }

    async findAll() {
        try {
            return await this.prisma.seatPricingRule.findMany({
                orderBy: { seatType: 'asc' },
            });
        } catch (error) {
            this.logger.error('Failed to fetch seat pricing rules', error?.stack);
            throw new InternalServerErrorException('Failed to fetch data');
        }
    }

    async findOne(seatType: string) {
        try {
            const rule = await this.prisma.seatPricingRule.findUnique({
                where: { seatType: seatType as any },
            });

            if (!rule) {
                throw new NotFoundException(`Seat pricing not found`);
            }

            return rule;
        } catch (error) {
            this.logger.error('Failed to fetch seat pricing rule', error?.stack);

            if (error instanceof NotFoundException) throw error;

            throw new InternalServerErrorException('Unexpected error');
        }
    }

    async update(seatType: string, dto: UpdateSeatPricingDto) {
        try {
            const existing = await this.prisma.seatPricingRule.findUnique({
                where: { seatType: seatType as any },
            });

            if (!existing) {
                throw new NotFoundException('Seat pricing rule not found');
            }

            return await this.prisma.seatPricingRule.update({
                where: { seatType: seatType as any },
                data: dto,
            });
        } catch (error) {
            this.logger.error('Failed to update seat pricing rule', error?.stack);

            if (error instanceof NotFoundException) throw error;

            throw new InternalServerErrorException('Update failed');
        }
    }

    async remove(seatType: string) {
        try {
            const existing = await this.prisma.seatPricingRule.findUnique({
                where: { seatType: seatType as any },
            });

            if (!existing) {
                throw new NotFoundException('Seat pricing rule not found');
            }

            return await this.prisma.seatPricingRule.delete({
                where: { seatType: seatType as any },
            });
        } catch (error) {
            this.logger.error('Failed to delete seat pricing rule', error?.stack);

            if (error instanceof NotFoundException) throw error;

            throw new InternalServerErrorException('Delete failed');
        }
    }

    async toggleActive(seatType: SeatType) {
        try {
            const existing = await this.prisma.seatPricingRule.findUnique({
                where: { seatType },
            });

            if (!existing) {
                throw new NotFoundException('Seat pricing rule not found');
            }

            const updated = await this.prisma.seatPricingRule.update({
                where: { seatType },
                data: {
                    isActive: !existing.isActive,
                },
            });

            this.logger.log(
                `Seat pricing ${seatType} toggled to ${updated.isActive}`,
            );

            return updated;
        } catch (error) {
            this.logger.error(
                'Failed to toggle seat pricing active state',
                error?.stack,
            );

            if (error instanceof NotFoundException) throw error;

            throw new InternalServerErrorException('Toggle failed');
        }
    }
}
import {
    Injectable,
    Logger,
    NotFoundException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScreenTemplateDto } from './dto/create-screen-template.dto';
import { UpdateScreenTemplateDto } from './dto/update-screen-template.dto';

@Injectable()
export class ScreenTemplateService {
    private readonly logger = new Logger(ScreenTemplateService.name);

    constructor(private readonly prisma: PrismaService) {}

    async create(dto: CreateScreenTemplateDto) {
        try {
            this.logger.log(`Creating screen template: ${dto.name}`);

            return await this.prisma.screenTemplate.create({
                data: dto,
            });
        } catch (error: unknown) {
            const err = error as any;

            this.logger.error(
                'Create template failed',
                err?.stack || JSON.stringify(error),
            );

            throw new InternalServerErrorException('Failed to create template');
        }
    }

    async findAll() {
        try {
            return await this.prisma.screenTemplate.findMany({
                include: {
                    templateSeats: true,
                },
            });
        } catch (error) {
            this.logger.error('Fetch templates failed', error.stack);
            throw new InternalServerErrorException();
        }
    }

    async findOne(id: string) {
        try {
            const template = await this.prisma.screenTemplate.findUnique({
                where: { id },
                include: {
                    templateSeats: true,
                },
            });

            if (!template) {
                throw new NotFoundException('Screen template not found');
            }

            return template;
        } catch (error) {
            this.logger.error(`Fetch template ${id} failed`, error.stack);

            if (error instanceof NotFoundException) throw error;

            throw new InternalServerErrorException();
        }
    }

    async update(id: string, dto: UpdateScreenTemplateDto) {
        try {
            await this.findOne(id);

            return await this.prisma.screenTemplate.update({
                where: { id },
                data: dto,
            });
        } catch (error) {
            this.logger.error(`Update template ${id} failed`, error.stack);

            if (error instanceof NotFoundException) throw error;

            throw new InternalServerErrorException('Failed to update template');
        }
    }

    async remove(id: string) {
        try {
            await this.findOne(id);

            return await this.prisma.screenTemplate.delete({
                where: { id },
            });
        } catch (error) {
            this.logger.error(`Delete template ${id} failed`, error.stack);

            if (error instanceof NotFoundException) throw error;

            throw new InternalServerErrorException('Failed to delete template');
        }
    }



}
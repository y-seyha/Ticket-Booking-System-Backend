/* eslint-disable */
import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateScreenTemplateDto } from './dto/create-screen-template.dto';
import { UpdateScreenTemplateDto } from './dto/update-screen-template.dto';

@Injectable()
export class ScreenTemplateService {
  private readonly logger = new Logger(ScreenTemplateService.name);
  private readonly ttlSeconds = 300;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async create(dto: CreateScreenTemplateDto) {
    try {
      this.logger.log(`Creating screen template: ${dto.name}`);

      const created = await this.prisma.screenTemplate.create({
        data: {
          name: dto.name,
          type: dto.type,
          description: dto.description,
          screenSurcharge: dto.screenSurcharge,
        },
      });

      await this.invalidateAll();

      return created;
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
      return await this.redisService.getOrSet(
        'screen-template:list',
        this.ttlSeconds,
        async () => {
          const templates = await this.prisma.screenTemplate.findMany({
            include: {
              templateSeats: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          });

          return templates.map((tmpl) => this.normalizeTemplate(tmpl));
        },
      );
    } catch (error) {
      this.logger.error('Fetch templates failed', error.stack);
      throw new InternalServerErrorException();
    }
  }

  async findOne(id: string) {
    try {
      return await this.redisService.getOrSet(
        `screen-template:one:${id}`,
        this.ttlSeconds,
        async () => {
          const template = await this.prisma.screenTemplate.findUnique({
            where: { id },
            include: {
              templateSeats: true,
            },
          });

          if (!template) {
            throw new NotFoundException('Screen template not found');
          }

          return this.normalizeTemplate(template);
        },
      );
    } catch (error) {
      this.logger.error(`Fetch template ${id} failed`, error.stack);

      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException();
    }
  }

  private normalizeTemplate(template: any) {
    if (!template) return null;

    return {
      ...template,
      layouts: [
        {
          id: template.id,
          layoutId: template.id,
          name: `${template.name} - Default Layout`,
          layoutName: `${template.name} - Default Layout`,
          seatsCount: template.templateSeats?.length || 0,
        }
      ]
    };
  }

  async update(id: string, dto: UpdateScreenTemplateDto) {
    try {
      await this.findOne(id);

      const updated = await this.prisma.screenTemplate.update({
        where: { id },
        data: dto,
      });

      await this.invalidateAll();

      return updated;
    } catch (error) {
      this.logger.error(`Update template ${id} failed`, error.stack);

      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException('Failed to update template');
    }
  }

  async remove(id: string) {
    try {
      await this.findOne(id);

      const deleted = await this.prisma.screenTemplate.delete({
        where: { id },
      });

      await this.invalidateAll();

      return deleted;
    } catch (error) {
      this.logger.error(`Delete template ${id} failed`, error.stack);

      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException('Failed to delete template');
    }
  }

  async toggleActive(id: string) {
    try {
      this.logger.log(`Toggling ScreenTemplate ${id}`);

      const template = await this.prisma.screenTemplate.findUnique({
        where: { id },
        select: { isActive: true },
      });

      if (!template) {
        throw new NotFoundException('Screen template not found');
      }

      const updated = await this.prisma.screenTemplate.update({
        where: { id },
        data: {
          isActive: !template.isActive,
        },
      });

      await this.invalidateAll();

      return updated;
    } catch (error: any) {
      this.logger.error(
        `Toggle active failed for ${id}`,
        error?.stack || error,
      );

      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException(
        'Failed to toggle screen template status',
      );
    }
  }

  private async invalidateAll() {
    await this.redisService.delPattern('screen-template:*');
  }
}

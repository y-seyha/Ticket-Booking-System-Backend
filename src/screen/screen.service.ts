/* eslint-disable */

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
import { Prisma, SeatStatus } from '@prisma/client'; // Removed unused SeatType to fix ESLint warning

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
        `Creating screen for theater=${dto.theaterId}, template=${dto.templateId}, layout=${dto.layoutId}`,
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
          layouts: {
            where: {
              id: dto.layoutId,
            },
            include: {
              seats: true,
            },
          },
        },
      });

      if (!template) {
        throw new NotFoundException('Screen template not found');
      }

       const targetLayout = template.layouts.find((l) => l.id === dto.layoutId);

      if (!targetLayout) {
        throw new NotFoundException(
          'The selected layout variant does not exist on this screen template',
        );
      }

      if (!targetLayout.seats || targetLayout.seats.length === 0) {
        throw new BadRequestException(
          'The selected layout variant does not contain any seat configurations',
        );
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

        const templateWithSeatsPayload: ScreenTemplateWithSeats = {
          ...template,
          templateSeats: targetLayout.seats.map((seat) => ({
            id: seat.id,
            layoutId: seat.layoutId,
            seatRow: seat.seatRow,
            seatNumber: seat.seatNumber,
            posX: seat.posX,
            posY: seat.posY,
            seatType: seat.seatType,
            screenTemplateId: null,
          })),
        };

        await this.generateSeats(tx, screen.id, templateWithSeatsPayload);

        this.logger.log(`Screen created: ${screen.id}`);

        return screen;
      });
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Failed to create screen', errorStack);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to create screen');
    }
  }

  private async generateSeats(
    tx: Prisma.TransactionClient,
    screenId: string,
    template: ScreenTemplateWithSeats,
  ) {
    if (!template.templateSeats || template.templateSeats.length === 0) {
      throw new BadRequestException('Template has no seats defined');
    }

    const seats: Prisma.SeatCreateManyInput[] = template.templateSeats.map(
      (tSeat) => ({
        screenId,
        seatRow: tSeat.seatRow,
        seatNumber: tSeat.seatNumber,
        posX: tSeat.posX,
        posY: tSeat.posY,
        seatType: tSeat.seatType,
        status: SeatStatus.ACTIVE,
      }),
    );

    await tx.seat.createMany({
      data: seats,
    });

    this.logger.log(`Generated ${seats.length} seats for screen ${screenId}`);
  }

  private normalizeScreen(screen: any) {
    if (!screen) return null;

    const layouts = screen.template?.layouts || screen.template?.variants || [];
    const availableIds = layouts.map((l: any) => l.id).filter(Boolean);

    const structuralLayoutId = Object.keys(screen).find(
      (key) =>
        typeof screen[key] === 'string' && availableIds.includes(screen[key]),
    );

    const finalLayoutId = structuralLayoutId
      ? screen[structuralLayoutId]
      : null;

    const activeLayout =
      layouts.find((l: any) => l.id === finalLayoutId) || layouts[0] || null;

    const { template, ...screenData } = screen;

    return {
      ...screenData,
      template: template
        ? {
            id: template.id,
            name: template.name,
            type: template.type,
            isActive: template.isActive,
          }
        : null,
      layout: activeLayout,
      availableLayouts: layouts,
    };
  }

  async findAll() {
    try {
      const screens = await this.prisma.screen.findMany({
        include: {
          theater: true,
          seats: true,
          template: {
            include: {
              layouts: true,
              templateSeats: true,
            },
          },
        },
      });

      return screens.map((screen) => this.normalizeScreen(screen));
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to fetch screens', err?.stack || String(error));
      throw new InternalServerErrorException();
    }
  }

  async findOne(id: string) {
    const screen = await this.prisma.screen.findUnique({
      where: { id },
      include: {
        theater: true,
        seats: true,
        template: {
          include: {
            layouts: true,
            templateSeats: true,
          },
        },
      },
    });

    if (!screen) {
      throw new NotFoundException('Screen not found');
    }

    return this.normalizeScreen(screen);
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
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to update screen ${id}`, errorStack);

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
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to delete screen ${id}`, errorStack);

      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException('Failed to delete screen');
    }
  }
}

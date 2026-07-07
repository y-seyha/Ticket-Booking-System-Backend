/* eslint-disable */
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
import { UpdateTemplateLayoutDto } from './dto/update-template.dto';


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
      const seats = await this.prisma.screenTemplateSeat.findMany({
        include: {
          layout: {
            include: {
              template: true,
            },
          },
        },
        orderBy: [{ layoutId: 'asc' }, { posY: 'asc' }, { posX: 'asc' }],
      });

      const normalizedMap = seats.reduce(
        (acc, currentSeat) => {
          const layout = currentSeat.layout;
          const template = layout?.template;

          if (!template || !layout) return acc;

          if (!acc[template.id]) {
            acc[template.id] = {
              templateId: template.id,
              templateName: template.name,
              screenType: template.type,
              screenSurcharge: template.screenSurcharge,
              isActive: template.isActive,
              layouts: {},
            };
          }

          if (!acc[template.id].layouts[layout.id]) {
            acc[template.id].layouts[layout.id] = {
              layoutId: layout.id,
              layoutName: layout.name,
              createdAt: layout.createdAt,
              updatedAt : layout.updatedAt,
              seats: [],
            };
          }

          acc[template.id].layouts[layout.id].seats.push({
            id: currentSeat.id,
            seatRow: currentSeat.seatRow,
            seatNumber: currentSeat.seatNumber,
            posX: currentSeat.posX,
            posY: currentSeat.posY,
            seatType: currentSeat.seatType,
          });

          return acc;
        },
        {} as Record<string, any>,
      );

      return Object.values(normalizedMap).map((templateNode: any) => ({
        ...templateNode,
        layouts: Object.values(templateNode.layouts),
      }));
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
          layout: {
            include: {
              template: true,
            },
          },
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
        where: {
          layout: {
            templateId: templateId,
          },
        },
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
      // 1. Verify the parent ScreenTemplate actually exists
      const targetTemplate = await this.prisma.screenTemplate.findUnique({
        where: { id: dto.templateId },
        include: { layouts: true },
      });

      if (!targetTemplate) {
        throw new NotFoundException('Screen template not found');
      }

      if (!dto.seatMap?.length) {
        throw new BadRequestException(
          'Seat map must contain at least one row configuration',
        );
      }

      if (dto.seatsPerRow <= 0) {
        throw new BadRequestException('Seats per row must be greater than 0');
      }


      const nextVariantNumber = targetTemplate.layouts.length + 1;
      const layoutName = `Layout Variant ${nextVariantNumber} (${dto.seatMap.length}x${dto.seatsPerRow})`;


      const newLayout = await this.prisma.seatLayout.create({
        data: {
          name: layoutName,
          templateId: dto.templateId,
        },
      });

      const seatsData: Prisma.ScreenTemplateSeatCreateManyInput[] = [];

      for (const rowConfig of dto.seatMap) {
        for (let num = 1; num <= dto.seatsPerRow; num++) {
          seatsData.push({
            layoutId: newLayout.id, // Grouped perfectly under this isolated layout instance
            seatRow: rowConfig.row,
            seatNumber: num,
            posX: num,
            posY: this.parseRowToYCoordinate(rowConfig.row),
            seatType: rowConfig.seatType,
          });
        }
      }

      const result = await this.prisma.screenTemplateSeat.createMany({
        data: seatsData,
      });

      return {
        message: 'Successfully generated a new seat template layout variant',
        screenTemplateId: dto.templateId,
        seatLayout: {
          id: newLayout.id,
          name: newLayout.name,
          totalSeatsGenerated: result.count,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Bulk seat generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async updateLayout(
    templateId: string,
    layoutId: string,
    dto: UpdateTemplateLayoutDto,
  ) {
    try {
      const existingLayout = await this.prisma.seatLayout.findFirst({
        where: { id: layoutId, templateId: templateId },
      });

      if (!existingLayout) {
        throw new NotFoundException(
          `Layout variant not found or does not belong to the specified screen template.`,
        );
      }

      return await this.prisma.$transaction(async (tx) => {
        let finalName = dto.name || existingLayout.name;
        if (!dto.name && dto.seatMap && dto.seatsPerRow) {
          finalName = `Layout Variant (${dto.seatMap.length}x${dto.seatsPerRow}) [Updated]`;
        }

        const updatedLayout = await tx.seatLayout.update({
          where: { id: layoutId },
          data: { name: finalName },
        });

        if (dto.seatMap) {
          if (!dto.seatsPerRow || dto.seatsPerRow <= 0) {
            throw new BadRequestException(
              'To update the seat configuration layout, a valid seatsPerRow value (> 0) is required.',
            );
          }

          await tx.screenTemplateSeat.deleteMany({
            where: { layoutId: layoutId },
          });

          const seatsData: Prisma.ScreenTemplateSeatCreateManyInput[] = [];

          for (const rowConfig of dto.seatMap) {
            for (let num = 1; num <= dto.seatsPerRow; num++) {
              seatsData.push({
                layoutId: layoutId,
                seatRow: rowConfig.row,
                seatNumber: num,
                posX: num,
                posY: this.parseRowToYCoordinate(rowConfig.row),
                seatType: rowConfig.seatType,
              });
            }
          }

          await tx.screenTemplateSeat.createMany({
            data: seatsData,
          });
        }

        return {
          message: 'Successfully updated template layout configuration',
          templateId,
          layoutId,
          layoutName: updatedLayout.name,
          seatsUpdated: !!dto.seatMap,
        };
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.handleError(
        error,
        `Update layout ${layoutId} failed`,
        'Failed to modify screen template layout schema',
      );
    }
  }

  async deleteLayout(templateId: string, layoutId: string) {
    try {
      const existingLayout = await this.prisma.seatLayout.findFirst({
        where: { id: layoutId, templateId: templateId },
      });

      if (!existingLayout) {
        throw new NotFoundException(
          `Layout variant not found or does not belong to this template constraint.`,
        );
      }

      await this.prisma.seatLayout.delete({
        where: { id: layoutId },
      });

      return {
        message:
          'Successfully removed layout option and all associated template seats',
        templateId,
        deletedLayoutId: layoutId,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.handleError(
        error,
        `Delete layout variant ${layoutId} failed`,
        'Failed to eliminate layout variant option',
      );
    }
  }

  private parseRowToYCoordinate(row: string): number {
    const cleanRow = row.toUpperCase().replace(/[^A-Z]/g, '');
    let y = 0;
    for (let i = 0; i < cleanRow.length; i++) {
      y = y * 26 + (cleanRow.charCodeAt(i) - 64);
    }
    return y;
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { ScreenService } from './screen.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SeatStatus } from '@prisma/client';

describe('ScreenService', () => {
  let service: ScreenService;

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
  };

  const mockPrisma = {
    theater: {
      findUnique: jest.fn(),
    },
    screenTemplate: {
      findUnique: jest.fn(),
    },
    screen: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    seat: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScreenService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ScreenService>(ScreenService);

    // override private logger
    (service as any).logger = mockLogger;
  });

  describe('create (extended)', () => {
    const dto = {
      theaterId: 't1',
      templateId: 'tpl1',
      name: 'Screen A',
      type: 'STANDARD',
    } as any;

    beforeEach(() => {
      jest.clearAllMocks();
    });


    it('should create screen and generate seats successfully', async () => {
      mockPrisma.theater.findUnique.mockResolvedValue({ id: 't1' });

      mockPrisma.screenTemplate.findUnique.mockResolvedValue({
        id: 'tpl1',
        type: 'STANDARD',
        templateSeats: [
          {
            seatRow: 'A',
            seatNumber: 1,
            posX: 10,
            posY: 20,
            seatType: 'REGULAR',
          },
          {
            seatRow: 'A',
            seatNumber: 2,
            posX: 30,
            posY: 40,
            seatType: 'VIP',
          },
        ],
      });

      const mockScreenCreate = jest.fn().mockResolvedValue({ id: 'screen1' });
      const mockSeatCreateMany = jest.fn().mockResolvedValue({ count: 2 });

      mockPrisma.$transaction.mockImplementation(async (cb) => {
        return cb({
          screen: {
            create: mockScreenCreate,
          },
          seat: {
            createMany: mockSeatCreateMany,
          },
        });
      });

      const result = await service.create(dto);

      expect(result).toEqual({ id: 'screen1' });

      expect(mockScreenCreate).toHaveBeenCalledWith({
        data: {
          theaterId: 't1',
          templateId: 'tpl1',
          name: 'Screen A',
          type: 'STANDARD',
        },
      });

      expect(mockSeatCreateMany).toHaveBeenCalledTimes(1);

      expect(mockLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('Creating screen'),
      );

      expect(mockLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('Screen created'),
      );
    });


    it('should throw InternalServerErrorException if screen.create fails', async () => {
      mockPrisma.theater.findUnique.mockResolvedValue({ id: 't1' });

      mockPrisma.screenTemplate.findUnique.mockResolvedValue({
        id: 'tpl1',
        type: 'STANDARD',
        templateSeats: [
          {
            seatRow: 'A',
            seatNumber: 1,
            posX: 0,
            posY: 0,
            seatType: 'REGULAR',
          },
        ],
      });

      mockPrisma.$transaction.mockImplementation(async (cb) => {
        return cb({
          screen: {
            create: jest.fn().mockRejectedValue(new Error('insert failed')),
          },
          seat: {
            createMany: jest.fn(),
          },
        });
      });

      await expect(service.create(dto)).rejects.toThrow(
          InternalServerErrorException,
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException if seat creation fails', async () => {
      mockPrisma.theater.findUnique.mockResolvedValue({ id: 't1' });

      mockPrisma.screenTemplate.findUnique.mockResolvedValue({
        id: 'tpl1',
        type: 'STANDARD',
        templateSeats: [
          {
            seatRow: 'A',
            seatNumber: 1,
            posX: 0,
            posY: 0,
            seatType: 'REGULAR',
          },
        ],
      });

      const mockScreenCreate = jest.fn().mockResolvedValue({ id: 'screen1' });
      const mockSeatCreateMany = jest.fn().mockRejectedValue(
          new Error('seat insert failed'),
      );

      mockPrisma.$transaction.mockImplementation(async (cb) => {
        return cb({
          screen: {
            create: mockScreenCreate,
          },
          seat: {
            createMany: mockSeatCreateMany,
          },
        });
      });

      await expect(service.create(dto)).rejects.toThrow(
          InternalServerErrorException,
      );
    });


    it('should throw BadRequestException when templateSeats is undefined', async () => {
      mockPrisma.theater.findUnique.mockResolvedValue({ id: 't1' });

      mockPrisma.screenTemplate.findUnique.mockResolvedValue({
        id: 'tpl1',
        type: 'STANDARD',
        templateSeats: undefined,
      });

      mockPrisma.$transaction.mockImplementation(async (cb) => {
        return cb({
          screen: {
            create: jest.fn().mockResolvedValue({ id: 'screen1' }),
          },
          seat: {
            createMany: jest.fn(),
          },
        });
      });

      await expect(service.create(dto)).rejects.toThrow(
          BadRequestException,
      );
    });

    it('should throw BadRequestException when templateSeats is null', async () => {
      mockPrisma.theater.findUnique.mockResolvedValue({ id: 't1' });

      mockPrisma.screenTemplate.findUnique.mockResolvedValue({
        id: 'tpl1',
        type: 'STANDARD',
        templateSeats: null,
      });

      mockPrisma.$transaction.mockImplementation(async (cb) => {
        return cb({
          screen: {
            create: jest.fn().mockResolvedValue({ id: 'screen1' }),
          },
          seat: {
            createMany: jest.fn(),
          },
        });
      });

      await expect(service.create(dto)).rejects.toThrow(
          BadRequestException,
      );
    });


    it('should correctly transform templateSeats into SeatCreateManyInput', async () => {
      mockPrisma.theater.findUnique.mockResolvedValue({ id: 't1' });

      const templateSeats = [
        {
          seatRow: 'B',
          seatNumber: 5,
          posX: 100,
          posY: 200,
          seatType: 'VIP',
        },
      ];

      mockPrisma.screenTemplate.findUnique.mockResolvedValue({
        id: 'tpl1',
        type: 'STANDARD',
        templateSeats,
      });

      const mockSeatCreateMany = jest.fn();

      mockPrisma.$transaction.mockImplementation(async (cb) => {
        return cb({
          screen: {
            create: jest.fn().mockResolvedValue({ id: 'screen1' }),
          },
          seat: {
            createMany: mockSeatCreateMany,
          },
        });
      });

      await service.create(dto);

      expect(mockSeatCreateMany).toHaveBeenCalledWith({
        data: [
          {
            screenId: 'screen1',
            seatRow: 'B',
            seatNumber: 5,
            posX: 100,
            posY: 200,
            seatType: 'VIP',
            status: SeatStatus.ACTIVE,
          },
        ],
      });
    });


    it('should log creation flow correctly', async () => {
      mockPrisma.theater.findUnique.mockResolvedValue({ id: 't1' });

      mockPrisma.screenTemplate.findUnique.mockResolvedValue({
        id: 'tpl1',
        type: 'STANDARD',
        templateSeats: [
          {
            seatRow: 'A',
            seatNumber: 1,
            posX: 0,
            posY: 0,
            seatType: 'REGULAR',
          },
        ],
      });

      mockPrisma.$transaction.mockImplementation(async (cb) => {
        return cb({
          screen: {
            create: jest.fn().mockResolvedValue({ id: 'screen1' }),
          },
          seat: {
            createMany: jest.fn(),
          },
        });
      });

      await service.create(dto);

      expect(mockLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('Creating screen for theater'),
      );

      expect(mockLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('Screen created:'),
      );
    });
  });


  describe('findAll', () => {
    it('should return screens with relations', async () => {
      const mockScreens = [
        {
          id: '1',
          theater: { id: 't1' },
          template: { id: 'tpl1' },
          seats: [{ id: 's1' }],
        },
      ];

      mockPrisma.screen.findMany.mockResolvedValue(mockScreens);

      const result = await service.findAll();

      expect(result).toEqual(mockScreens);

      // ensure prisma called with include (important real bug check)
      expect(mockPrisma.screen.findMany).toHaveBeenCalledWith({
        include: {
          theater: true,
          template: true,
          seats: true,
        },
      });
    });

    it('should return empty array when no screens exist', async () => {
      mockPrisma.screen.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should handle large dataset', async () => {
      const largeMock = Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        theater: { id: 't' + i },
        template: { id: 'tpl' + i },
        seats: [],
      }));

      mockPrisma.screen.findMany.mockResolvedValue(largeMock);

      const result = await service.findAll();

      expect(result.length).toBe(50);
      expect(result[10].id).toBe('10');
    });

    it('should throw InternalServerErrorException on Prisma crash', async () => {
      mockPrisma.screen.findMany.mockRejectedValue(new Error('DB crashed'));

      await expect(service.findAll()).rejects.toThrow(
          InternalServerErrorException,
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException even with undefined error', async () => {
      mockPrisma.screen.findMany.mockRejectedValue(undefined);

      await expect(service.findAll()).rejects.toThrow(
          InternalServerErrorException,
      );
    });
  });


  describe('findOne', () => {
    it('should return screen with relations', async () => {
      const mockScreen = {
        id: '1',
        theater: { id: 't1' },
        template: { id: 'tpl1' },
        seats: [{ id: 's1' }],
      };

      mockPrisma.screen.findUnique.mockResolvedValue(mockScreen);

      const result = await service.findOne('1');

      expect(result).toEqual(mockScreen);

      expect(mockPrisma.screen.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: {
          theater: true,
          template: true,
          seats: true,
        },
      });
    });

    it('should throw NotFoundException when screen does not exist', async () => {
      mockPrisma.screen.findUnique.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(
          NotFoundException,
      );
    });

    it('should throw NotFoundException with correct message', async () => {
      mockPrisma.screen.findUnique.mockResolvedValue(null);

      try {
        await service.findOne('1');
      } catch (e) {
        expect(e).toBeInstanceOf(NotFoundException);
        expect(e.message).toContain('Screen not found');
      }
    });

    it('should handle empty string id safely', async () => {
      mockPrisma.screen.findUnique.mockResolvedValue(null);

      await expect(service.findOne('')).rejects.toThrow(
          NotFoundException,
      );
    });

    it('should handle undefined id safely', async () => {
      mockPrisma.screen.findUnique.mockResolvedValue(null);

      await expect(service.findOne(undefined as any)).rejects.toThrow(
          NotFoundException,
      );
    });

    it('should handle Prisma unexpected error', async () => {
      mockPrisma.screen.findUnique.mockRejectedValue(
          new Error('Connection lost'),
      );

      await expect(service.findOne('1')).rejects.toThrow();
    });
  });

  describe('update', () => {
    const dto = { name: 'Updated' } as any;

    it('should update screen', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: '1' } as any);

      mockPrisma.screen.update.mockResolvedValue({
        id: '1',
        name: 'Updated',
      });

      const result = await service.update('1', dto);

      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundException when template not found', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: '1' } as any);

      mockPrisma.screenTemplate.findUnique.mockResolvedValue(null);

      await expect(
          service.update('1', { templateId: 'bad' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException on type mismatch', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: '1' } as any);

      mockPrisma.screenTemplate.findUnique.mockResolvedValue({
        id: 'tpl',
        type: 'IMAX',
      });

      await expect(
          service.update('1', {
            templateId: 'tpl',
            type: 'STANDARD',
          } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException', async () => {
      jest.spyOn(service, 'findOne').mockRejectedValue(new Error());

      await expect(service.update('1', dto)).rejects.toThrow(
          InternalServerErrorException,
      );
    });
  });


  describe('remove', () => {
    it('should delete screen', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: '1' } as any);

      mockPrisma.screen.delete.mockResolvedValue({ id: '1' });

      const result = await service.remove('1');

      expect(result).toEqual({ id: '1' });
    });

    it('should throw NotFoundException', async () => {
      jest.spyOn(service, 'findOne').mockRejectedValue(
          new NotFoundException(),
      );

      await expect(service.remove('1')).rejects.toThrow(
          NotFoundException,
      );
    });

    it('should throw InternalServerErrorException', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: '1' } as any);
      mockPrisma.screen.delete.mockRejectedValue(new Error());

      await expect(service.remove('1')).rejects.toThrow(
          InternalServerErrorException,
      );
    });
  });
});
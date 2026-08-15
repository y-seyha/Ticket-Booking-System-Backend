import { Test, TestingModule } from '@nestjs/testing';
import { SeatTemplateService } from './seat-template.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

describe('SeatTemplateService', () => {
  let service: SeatTemplateService;

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
  };

  const mockRedis = {
    isReady: jest.fn(() => true),
    getJson: jest.fn(async () => null),
    setJson: jest.fn(),
    del: jest.fn(),
    delPattern: jest.fn(),
    getOrSet: jest.fn(async (_key: string, _ttl: number, loader: () => unknown) =>
      loader(),
    ),
  };

  const mockPrisma = {
    screenTemplateSeat: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      createMany: jest.fn(),
    },
    screenTemplate: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeatTemplateService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get(SeatTemplateService);
    (service as any).logger = mockLogger;
  });

  describe('findAll', () => {
    it('should return all seats', async () => {
      const data = [{ id: '1' }];

      mockPrisma.screenTemplateSeat.findMany.mockResolvedValue(data);

      const result = await service.findAll();

      expect(result).toEqual(data);
      expect(mockPrisma.screenTemplateSeat.findMany).toHaveBeenCalledWith({
        include: { template: true },
      });
    });

    it('should handle empty array', async () => {
      mockPrisma.screenTemplateSeat.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should throw InternalServerErrorException on crash', async () => {
      mockPrisma.screenTemplateSeat.findMany.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(service.findAll()).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle undefined error safely', async () => {
      mockPrisma.screenTemplateSeat.findMany.mockRejectedValue(undefined);

      await expect(service.findAll()).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return seat', async () => {
      mockPrisma.screenTemplateSeat.findUnique.mockResolvedValue({
        id: '1',
      });

      const result = await service.findOne('1');

      expect(result).toEqual({ id: '1' });
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.screenTemplateSeat.findUnique.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });

    it('should propagate NotFoundException through handleError', async () => {
      mockPrisma.screenTemplateSeat.findUnique.mockResolvedValue(null);

      try {
        await service.findOne('1');
      } catch (e) {
        expect(e).toBeInstanceOf(NotFoundException);
      }
    });

    it('should handle prisma crash', async () => {
      mockPrisma.screenTemplateSeat.findUnique.mockRejectedValue(
        new Error('fail'),
      );

      await expect(service.findOne('1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findByTemplate', () => {
    it('should return ordered seats', async () => {
      mockPrisma.screenTemplate.findUnique.mockResolvedValue({ id: 't1' });

      const data = [{ id: 's1' }];
      mockPrisma.screenTemplateSeat.findMany.mockResolvedValue(data);

      const result = await service.findByTemplate('t1');

      expect(result).toEqual(data);

      expect(mockPrisma.screenTemplateSeat.findMany).toHaveBeenCalledWith({
        where: { templateId: 't1' },
        orderBy: [{ posY: 'asc' }, { posX: 'asc' }],
      });
    });

    it('should throw NotFoundException if template not found', async () => {
      mockPrisma.screenTemplate.findUnique.mockResolvedValue(null);

      await expect(service.findByTemplate('t1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle prisma failure', async () => {
      mockPrisma.screenTemplate.findUnique.mockResolvedValue({ id: 't1' });

      mockPrisma.screenTemplateSeat.findMany.mockRejectedValue(
        new Error('fail'),
      );

      await expect(service.findByTemplate('t1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('generateBulk', () => {
    const dto = {
      templateId: 't1',
      seatsPerRow: 3,
      seatMap: [
        { row: 'A', seatType: 'REGULAR' },
        { row: 'B', seatType: 'VIP' },
      ],
    } as any;

    it('should generate seats successfully', async () => {
      mockPrisma.screenTemplate.findUnique.mockResolvedValue({ id: 't1' });

      mockPrisma.screenTemplateSeat.createMany.mockResolvedValue({
        count: 6,
      });

      const result = await service.generateBulk(dto);

      expect(result).toEqual({
        message: 'Template seats generated successfully',
        total: 6,
      });

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Generating seats'),
      );
    });

    it('should throw NotFoundException if template missing', async () => {
      mockPrisma.screenTemplate.findUnique.mockResolvedValue(null);

      await expect(service.generateBulk(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when seatMap empty', async () => {
      mockPrisma.screenTemplate.findUnique.mockResolvedValue({ id: 't1' });

      await expect(
        service.generateBulk({ ...dto, seatMap: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when seatsPerRow invalid', async () => {
      mockPrisma.screenTemplate.findUnique.mockResolvedValue({ id: 't1' });

      await expect(
        service.generateBulk({ ...dto, seatsPerRow: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle prisma createMany crash', async () => {
      mockPrisma.screenTemplate.findUnique.mockResolvedValue({ id: 't1' });

      mockPrisma.screenTemplateSeat.createMany.mockRejectedValue(
        new Error('DB fail'),
      );

      await expect(service.generateBulk(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should generate correct seat structure', async () => {
      mockPrisma.screenTemplate.findUnique.mockResolvedValue({ id: 't1' });

      let capturedData: any = null;

      mockPrisma.screenTemplateSeat.createMany.mockImplementation(
        ({ data }) => {
          capturedData = data;
          return Promise.resolve({ count: data.length });
        },
      );

      await service.generateBulk(dto);

      expect(capturedData.length).toBe(6);

      expect(capturedData[0]).toEqual(
        expect.objectContaining({
          templateId: 't1',
          seatRow: 'A',
          seatNumber: 1,
          posX: 1,
        }),
      );
    });

    it('should generate correct total seats (rows × seatsPerRow)', async () => {
      mockPrisma.screenTemplate.findUnique.mockResolvedValue({ id: 't1' });

      let captured: any[] = [];

      mockPrisma.screenTemplateSeat.createMany.mockImplementation(
        ({ data }) => {
          captured = data;
          return Promise.resolve({ count: data.length });
        },
      );

      await service.generateBulk(dto);

      // 2 rows × 3 seats = 6
      expect(captured).toHaveLength(6);
    });

    it('should correctly map row letter to posY', async () => {
      mockPrisma.screenTemplate.findUnique.mockResolvedValue({ id: 't1' });

      let captured: any[] = [];

      mockPrisma.screenTemplateSeat.createMany.mockImplementation(
        ({ data }) => {
          captured = data;
          return Promise.resolve({ count: data.length });
        },
      );

      await service.generateBulk(dto);

      const rowA = captured.find((s) => s.seatRow === 'A');
      const rowB = captured.find((s) => s.seatRow === 'B');

      expect(rowA.posY).toBe(1);
      expect(rowB.posY).toBe(2);
    });

    it('should generate sequential seat numbers per row', async () => {
      mockPrisma.screenTemplate.findUnique.mockResolvedValue({ id: 't1' });

      let captured: any[] = [];

      mockPrisma.screenTemplateSeat.createMany.mockImplementation(
        ({ data }) => {
          captured = data;
          return Promise.resolve({ count: data.length });
        },
      );

      await service.generateBulk(dto);

      const rowASeats = captured
        .filter((s) => s.seatRow === 'A')
        .map((s) => s.seatNumber);

      expect(rowASeats).toEqual([1, 2, 3]);
    });

    it('should assign correct seatType per row', async () => {
      mockPrisma.screenTemplate.findUnique.mockResolvedValue({ id: 't1' });

      let captured: any[] = [];

      mockPrisma.screenTemplateSeat.createMany.mockImplementation(
        ({ data }) => {
          captured = data;
          return Promise.resolve({ count: data.length });
        },
      );

      await service.generateBulk(dto);

      const rowA = captured.find((s) => s.seatRow === 'A');
      const rowB = captured.find((s) => s.seatRow === 'B');

      expect(rowA.seatType).toBe('REGULAR');
      expect(rowB.seatType).toBe('VIP');
    });

    it('should call createMany with skipDuplicates enabled', async () => {
      mockPrisma.screenTemplate.findUnique.mockResolvedValue({ id: 't1' });

      mockPrisma.screenTemplateSeat.createMany.mockResolvedValue({
        count: 6,
      });

      await service.generateBulk(dto);

      expect(mockPrisma.screenTemplateSeat.createMany).toHaveBeenCalledWith({
        data: expect.any(Array),
        skipDuplicates: true,
      });
    });

    it('should log generation start and completion', async () => {
      mockPrisma.screenTemplate.findUnique.mockResolvedValue({ id: 't1' });

      mockPrisma.screenTemplateSeat.createMany.mockResolvedValue({
        count: 6,
      });

      await service.generateBulk(dto);

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Generating seats'),
      );

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Created'),
      );
    });

    it('should handle single seat correctly', async () => {
      const smallDto = {
        templateId: 't1',
        seatsPerRow: 1,
        seatMap: [{ row: 'A', seatType: 'REGULAR' }],
      };

      mockPrisma.screenTemplate.findUnique.mockResolvedValue({ id: 't1' });

      mockPrisma.screenTemplateSeat.createMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.generateBulk(smallDto as any);

      expect(result).toEqual({
        message: 'Template seats generated successfully',
        total: 1,
      });
    });

    it('should handle large seat generation efficiently', async () => {
      const largeDto = {
        templateId: 't1',
        seatsPerRow: 50,
        seatMap: Array.from({ length: 10 }, (_, i) => ({
          row: String.fromCharCode(65 + i),
          seatType: 'REGULAR',
        })),
      };

      mockPrisma.screenTemplate.findUnique.mockResolvedValue({ id: 't1' });

      let captured: any[] = [];

      mockPrisma.screenTemplateSeat.createMany.mockImplementation(
        ({ data }) => {
          captured = data;
          return Promise.resolve({ count: data.length });
        },
      );

      await service.generateBulk(largeDto as any);

      expect(captured).toHaveLength(500); // 10 × 50
    });
  });
});

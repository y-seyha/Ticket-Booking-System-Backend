import { Test, TestingModule } from '@nestjs/testing';
import { ScreenTemplateService } from './screen-template.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import {ScreenType} from "@prisma/client";

describe('ScreenTemplateService', () => {
  let service: ScreenTemplateService;

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
  };

  const mockPrisma = {
    screenTemplate: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScreenTemplateService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(ScreenTemplateService);

    (service as any).logger = mockLogger;
  });

  describe('create (extended)', () => {
    const dto = {
      name: 'IMAX',
      type: 'STANDARD',
    } as any;

    beforeEach(() => {
      jest.clearAllMocks();
    });


    it('should create template successfully', async () => {
      mockPrisma.screenTemplate.create.mockResolvedValue({
        id: '1',
        name: 'IMAX',
        type: 'STANDARD',
      });

      const result = await service.create(dto);

      expect(result).toEqual({
        id: '1',
        name: 'IMAX',
        type: 'STANDARD',
      });

      expect(mockLogger.log).toHaveBeenCalledWith(
          'Creating screen template: IMAX',
      );

      expect(mockPrisma.screenTemplate.create).toHaveBeenCalledWith({
        data: dto,
      });
    });


    it('should not mutate input dto', async () => {
      const originalDto = {
        name: 'IMAX',
        type: ScreenType.STANDARD,
      };

      mockPrisma.screenTemplate.create.mockResolvedValue({
        id: '1',
        ...originalDto,
      });

      await service.create(originalDto);

      expect(originalDto).toEqual({
        name: 'IMAX',
        type: ScreenType.STANDARD,
      });
    });


    it('should handle empty name', async () => {
      const badDto = { name: '', type: 'STANDARD' } as any;

      mockPrisma.screenTemplate.create.mockResolvedValue({
        id: '1',
        ...badDto,
      });

      const result = await service.create(badDto);

      expect(result.name).toBe('');
      expect(mockLogger.log).toHaveBeenCalledWith(
          'Creating screen template: ',
      );
    });

    it('should handle missing type field', async () => {
      const badDto = { name: 'IMAX' } as any;

      mockPrisma.screenTemplate.create.mockResolvedValue({
        id: '1',
        ...badDto,
      });

      const result = await service.create(badDto);

      expect(result.name).toBe('IMAX');
    });


    it('should handle prisma returning partial object', async () => {
      mockPrisma.screenTemplate.create.mockResolvedValue({
        id: '1',
      });

      const result = await service.create(dto);

      expect(result).toEqual({ id: '1' });
    });


    it('should handle string thrown error', async () => {
      mockPrisma.screenTemplate.create.mockRejectedValue('DB crashed');

      await expect(service.create(dto)).rejects.toThrow(
          InternalServerErrorException,
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle null thrown error', async () => {
      mockPrisma.screenTemplate.create.mockRejectedValue(null);

      await expect(service.create(dto)).rejects.toThrow(
          InternalServerErrorException,
      );
    });

    it('should handle number thrown error', async () => {
      mockPrisma.screenTemplate.create.mockRejectedValue(500);

      await expect(service.create(dto)).rejects.toThrow(
          InternalServerErrorException,
      );
    });

    it('should log before prisma call', async () => {
      const callOrder: string[] = [];

      mockLogger.log.mockImplementation((msg) => callOrder.push('log'));
      mockPrisma.screenTemplate.create.mockImplementation(() => {
        callOrder.push('db');
        return Promise.resolve({ id: '1' });
      });

      await service.create(dto);

      expect(callOrder).toEqual(['log', 'db']);
    });

    it('should call prisma create exactly once', async () => {
      mockPrisma.screenTemplate.create.mockResolvedValue({
        id: '1',
        ...dto,
      });

      await service.create(dto);

      expect(mockPrisma.screenTemplate.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('should return templates with seats', async () => {
      const mockData = [
        {
          id: '1',
          templateSeats: [{ id: 's1' }],
        },
      ];

      mockPrisma.screenTemplate.findMany.mockResolvedValue(mockData);

      const result = await service.findAll();

      expect(result).toEqual(mockData);

      expect(mockPrisma.screenTemplate.findMany).toHaveBeenCalledWith({
        include: { templateSeats: true },
      });
    });

    it('should return empty array', async () => {
      mockPrisma.screenTemplate.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should throw InternalServerErrorException on prisma failure', async () => {
      mockPrisma.screenTemplate.findMany.mockRejectedValue(
          new Error('fail'),
      );

      await expect(service.findAll()).rejects.toThrow(
          InternalServerErrorException,
      );
    });
  });


  describe('findOne', () => {
    it('should return template', async () => {
      mockPrisma.screenTemplate.findUnique.mockResolvedValue({
        id: '1',
        templateSeats: [],
      });

      const result = await service.findOne('1');

      expect(result).toEqual({
        id: '1',
        templateSeats: [],
      });
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.screenTemplate.findUnique.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(
          NotFoundException,
      );
    });

    it('should propagate NotFoundException unchanged', async () => {
      mockPrisma.screenTemplate.findUnique.mockResolvedValue(null);

      try {
        await service.findOne('1');
      } catch (e) {
        expect(e).toBeInstanceOf(NotFoundException);
        expect(e.message).toContain('Screen template not found');
      }
    });

    it('should throw InternalServerErrorException on prisma crash', async () => {
      mockPrisma.screenTemplate.findUnique.mockRejectedValue(
          new Error('DB crash'),
      );

      await expect(service.findOne('1')).rejects.toThrow(
          InternalServerErrorException,
      );
    });
  });

  describe('update (extended)', () => {
    const dto = { name: 'Updated' } as any;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should call findOne with correct id', async () => {
      const findSpy = jest
          .spyOn(service, 'findOne')
          .mockResolvedValue({ id: '1' } as any);

      mockPrisma.screenTemplate.update.mockResolvedValue({
        id: '1',
        name: 'Updated',
      });

      await service.update('1', dto);

      expect(findSpy).toHaveBeenCalledWith('1');
    });

    it('should pass correct data to prisma update', async () => {
      jest
          .spyOn(service, 'findOne')
          .mockResolvedValue({ id: '1' } as any);

      await service.update('1', dto);

      expect(mockPrisma.screenTemplate.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: dto,
      });
    });

    it('should NOT call prisma update if findOne throws NotFoundException', async () => {
      const updateSpy = mockPrisma.screenTemplate.update;

      jest
          .spyOn(service, 'findOne')
          .mockRejectedValue(new NotFoundException());

      await expect(service.update('1', dto)).rejects.toThrow(
          NotFoundException,
      );

      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('should handle prisma returning minimal object', async () => {
      jest
          .spyOn(service, 'findOne')
          .mockResolvedValue({ id: '1' } as any);

      mockPrisma.screenTemplate.update.mockResolvedValue({
        id: '1',
      });

      const result = await service.update('1', dto);

      expect(result).toEqual({ id: '1' });
    });

    it('should handle string error thrown by prisma', async () => {
      jest
          .spyOn(service, 'findOne')
          .mockResolvedValue({ id: '1' } as any);

      mockPrisma.screenTemplate.update.mockRejectedValue('DB crash');

      await expect(service.update('1', dto)).rejects.toThrow(
          InternalServerErrorException,
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should log correct error message with id', async () => {
      jest
          .spyOn(service, 'findOne')
          .mockResolvedValue({ id: '1' } as any);

      mockPrisma.screenTemplate.update.mockRejectedValue(
          new Error('fail'),
      );

      await service.update('1', dto).catch(() => {});

      expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Update template 1 failed'),
          expect.anything(),
      );
    });

    it('should only call update once', async () => {
      jest
          .spyOn(service, 'findOne')
          .mockResolvedValue({ id: '1' } as any);

      mockPrisma.screenTemplate.update.mockResolvedValue({
        id: '1',
        name: 'Updated',
      });

      await service.update('1', dto);

      expect(mockPrisma.screenTemplate.update).toHaveBeenCalledTimes(1);
    });
  });


  describe('remove (extended)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should call findOne before delete', async () => {
      const callOrder: string[] = [];

      jest
          .spyOn(service, 'findOne')
          .mockImplementation(async () => {
            callOrder.push('findOne');
            return { id: '1' } as any;
          });

      mockPrisma.screenTemplate.delete.mockImplementation(async () => {
        callOrder.push('delete');
        return { id: '1' };
      });

      await service.remove('1');

      expect(callOrder).toEqual(['findOne', 'delete']);
    });

    it('should call prisma delete with correct id', async () => {
      jest
          .spyOn(service, 'findOne')
          .mockResolvedValue({ id: '1' } as any);

      await service.remove('1');

      expect(mockPrisma.screenTemplate.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should NOT call delete if findOne throws', async () => {
      const deleteSpy = mockPrisma.screenTemplate.delete;

      jest
          .spyOn(service, 'findOne')
          .mockRejectedValue(new NotFoundException());

      await expect(service.remove('1')).rejects.toThrow(
          NotFoundException,
      );

      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('should handle prisma returning null-like response', async () => {
      jest
          .spyOn(service, 'findOne')
          .mockResolvedValue({ id: '1' } as any);

      mockPrisma.screenTemplate.delete.mockResolvedValue(null as any);

      const result = await service.remove('1');

      expect(result).toBeNull();
    });

    it('should handle string thrown error', async () => {
      jest
          .spyOn(service, 'findOne')
          .mockResolvedValue({ id: '1' } as any);

      mockPrisma.screenTemplate.delete.mockRejectedValue('DB error');

      await expect(service.remove('1')).rejects.toThrow(
          InternalServerErrorException,
      );
    });

    it('should log delete error with correct id', async () => {
      jest
          .spyOn(service, 'findOne')
          .mockResolvedValue({ id: '1' } as any);

      mockPrisma.screenTemplate.delete.mockRejectedValue(
          new Error('fail'),
      );

      await service.remove('1').catch(() => {});

      expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Delete template 1 failed'),
          expect.anything(),
      );
    });

    it('should only call delete once', async () => {
      jest
          .spyOn(service, 'findOne')
          .mockResolvedValue({ id: '1' } as any);

      mockPrisma.screenTemplate.delete.mockResolvedValue({ id: '1' });

      await service.remove('1');

      expect(mockPrisma.screenTemplate.delete).toHaveBeenCalledTimes(1);
    });
  });
});
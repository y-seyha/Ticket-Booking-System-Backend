import { Test, TestingModule } from '@nestjs/testing';
import { TheaterService } from './theater.service';
import { PrismaService } from '../prisma/prisma.service';
import { FileUploadService } from '../file-upload/file-upload.service';
import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

describe('TheaterService', () => {
  let service: TheaterService;

  const prisma = {
    theater: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
    file: {
      delete: jest.fn(),
    },
  };

  const fileUploadService = {
    uploadFile: jest.fn(),
    cloudinary: {
      deleteFile: jest.fn(),
    },
  };

  const mockFile = { originalname: 'test.jpg' } as Express.Multer.File;

  beforeEach(async () => {
    jest.clearAllMocks();

    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    const module = await Test.createTestingModule({
      providers: [
        TheaterService,
        { provide: PrismaService, useValue: prisma },
        { provide: FileUploadService, useValue: fileUploadService },
      ],
    }).compile();

    service = module.get(TheaterService);
  });

  describe('create', () => {
    it('should create theater without file', async () => {
      prisma.theater.create.mockResolvedValue({ id: '1' });

      const result = await service.create({ name: 'T1' } as any);

      expect(prisma.theater.create).toHaveBeenCalled();
      expect(result).toEqual({ id: '1' });
    });

    it('should create theater with file upload', async () => {
      fileUploadService.uploadFile.mockResolvedValue({ id: 'file1' });
      prisma.theater.create.mockResolvedValue({ id: '1' });

      const result = await service.create(
        { name: 'T1' } as any,
        mockFile,
        'user1',
      );

      expect(fileUploadService.uploadFile).toHaveBeenCalled();
      expect(prisma.theater.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ imageId: 'file1' }),
        }),
      );

      expect(result.id).toBe('1');
    });

    it('should throw InternalServerErrorException on create fail', async () => {
      prisma.theater.create.mockRejectedValue(new Error('DB error'));

      await expect(service.create({ name: 'T1' } as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
    it('should throw InternalServerErrorException when file upload fails', async () => {
      fileUploadService.uploadFile.mockRejectedValue(
        new Error('Upload failed'),
      );

      await expect(
        service.create({ name: 'T1' } as any, mockFile, 'user1'),
      ).rejects.toThrow(InternalServerErrorException);

      expect(fileUploadService.uploadFile).toHaveBeenCalled();
      expect(prisma.theater.create).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when prisma fails after file upload', async () => {
      fileUploadService.uploadFile.mockResolvedValue({ id: 'file1' });

      prisma.theater.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.create({ name: 'T1' } as any, mockFile, 'user1'),
      ).rejects.toThrow(InternalServerErrorException);

      expect(fileUploadService.uploadFile).toHaveBeenCalled();
      expect(prisma.theater.create).toHaveBeenCalled();
    });

    it('should call uploadFile before prisma.create', async () => {
      fileUploadService.uploadFile.mockResolvedValue({ id: 'file1' });
      prisma.theater.create.mockResolvedValue({ id: '1' });

      await service.create({ name: 'T1' } as any, mockFile, 'user1');

      const uploadCallIndex =
        fileUploadService.uploadFile.mock.invocationCallOrder[0];
      const prismaCallIndex = prisma.theater.create.mock.invocationCallOrder[0];

      expect(uploadCallIndex).toBeLessThan(prismaCallIndex);
    });
  });

  describe('findAll', () => {
    it('should return paginated data', async () => {
      prisma.$transaction.mockResolvedValue([[{ id: '1' }], 1]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data.length).toBe(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should throw InternalServerErrorException on fail', async () => {
      prisma.$transaction.mockRejectedValue(new Error('DB error'));

      await expect(service.findAll({} as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should use default pagination values when not provided', async () => {
      prisma.$transaction.mockResolvedValue([[{ id: '1' }], 1]);

      await service.findAll({});

      expect(prisma.theater.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });

    it('should calculate skip correctly for page 3', async () => {
      prisma.$transaction.mockResolvedValue([[{ id: '1' }], 1]);

      await service.findAll({ page: 3, limit: 5 });

      expect(prisma.theater.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
        }),
      );
    });

    it('should apply search filter', async () => {
      prisma.$transaction.mockResolvedValue([[{ id: '1' }], 1]);

      await service.findAll({ search: 'imax' });

      expect(prisma.theater.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: {
              contains: 'imax',
              mode: 'insensitive',
            },
          }),
        }),
      );
    });

    it('should apply status filter', async () => {
      prisma.$transaction.mockResolvedValue([[{ id: '1' }], 1]);

      await service.findAll({ status: 'ACTIVE' } as any);

      expect(prisma.theater.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        }),
      );
    });

    it('should apply both search and status filters', async () => {
      prisma.$transaction.mockResolvedValue([[{ id: '1' }], 1]);

      await service.findAll({
        search: 'imax',
        status: 'ACTIVE',
      } as any);

      expect(prisma.theater.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'ACTIVE',
            name: {
              contains: 'imax',
              mode: 'insensitive',
            },
          },
        }),
      );
    });

    it('should return empty data when no theaters found', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAll({});

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('should calculate totalPages correctly', async () => {
      prisma.$transaction.mockResolvedValue([[], 25]);

      const result = await service.findAll({ limit: 10 });

      expect(result.pagination.totalPages).toBe(3);
    });

    it('should include screens and order by createdAt desc', async () => {
      prisma.$transaction.mockResolvedValue([[{ id: '1' }], 1]);

      await service.findAll({});

      expect(prisma.theater.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
          include: { screens: true },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return theater', async () => {
      prisma.theater.findUnique.mockResolvedValue({ id: '1' });

      const result = await service.findOne('1');

      expect(result.id).toBe('1');
    });

    it('should throw NotFoundException', async () => {
      prisma.theater.findUnique.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      prisma.theater.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(service.findOne('1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('update', () => {
    it('should update without file', async () => {
      prisma.theater.findUnique.mockResolvedValue({ id: '1' });
      prisma.theater.update.mockResolvedValue({ id: '1' });

      const result = await service.update('1', { name: 'new' });

      expect(prisma.theater.update).toHaveBeenCalled();
      expect(result.id).toBe('1');
    });

    it('should update with new image and delete old file', async () => {
      prisma.theater.findUnique.mockResolvedValue({
        id: '1',
        imageId: 'img1',
        image: { publicId: 'public1' },
      });

      fileUploadService.uploadFile.mockResolvedValue({ id: 'img2' });

      prisma.theater.update.mockResolvedValue({ id: '1' });

      await service.update('1', { name: 'new' }, mockFile, 'u1');

      expect(fileUploadService.uploadFile).toHaveBeenCalled();
      expect(fileUploadService.cloudinary.deleteFile).toHaveBeenCalledWith(
        'public1',
      );
      expect(prisma.file.delete).toHaveBeenCalledWith({
        where: { id: 'img1' },
      });
    });

    it('should throw NotFoundException', async () => {
      prisma.theater.findUnique.mockResolvedValue(null);

      await expect(service.update('1', {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on fail', async () => {
      prisma.theater.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(service.update('1', {} as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('remove', () => {
    it('should delete theater successfully', async () => {
      prisma.theater.findUnique.mockResolvedValue({
        id: '1',
        screens: [],
        imageId: null,
      });

      prisma.theater.delete.mockResolvedValue({ id: '1' });

      const result = await service.remove('1');

      expect(result.success).toBe(true);
    });

    it('should throw BadRequestException if screens exist', async () => {
      prisma.theater.findUnique.mockResolvedValue({
        id: '1',
        screens: [{ id: 's1' }],
        image: null,
      });

      await expect(service.remove('1')).rejects.toThrow(BadRequestException);
    });

    it('should delete image before deleting theater', async () => {
      prisma.theater.findUnique.mockResolvedValue({
        id: '1',
        screens: [],
        imageId: 'img1',
        image: { publicId: 'pub1' },
      });

      prisma.theater.delete.mockResolvedValue({ id: '1' });

      await service.remove('1');

      expect(fileUploadService.cloudinary.deleteFile).toHaveBeenCalledWith(
        'pub1',
      );
      expect(prisma.file.delete).toHaveBeenCalledWith({
        where: { id: 'img1' },
      });
    });

    it('should throw NotFoundException', async () => {
      prisma.theater.findUnique.mockResolvedValue(null);

      await expect(service.remove('1')).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on fail', async () => {
      prisma.theater.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(service.remove('1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});

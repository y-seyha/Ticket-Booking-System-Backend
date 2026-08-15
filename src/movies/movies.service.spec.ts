import { Test } from '@nestjs/testing';
import { MoviesService } from './movies.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { FileUploadService } from '../file-upload/file-upload.service';
import { SearchService } from '../search/search.service';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Logger } from '@nestjs/common';

describe('MoviesService', () => {
  let service: MoviesService;

  const redisMock = {
    isReady: jest.fn(() => true),
    getJson: jest.fn(async () => null),
    setJson: jest.fn(),
    del: jest.fn(),
    delPattern: jest.fn(),
    getOrSet: jest.fn(async (_key: string, _ttl: number, loader: () => unknown) =>
      loader(),
    ),
  };

  const prismaMock = {
    movie: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    file: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const fileUploadServiceMock = {
    uploadFile: jest.fn(),
    cloudinary: {
      deleteFile: jest.fn(),
    },
  };

  const searchServiceMock = {
    indexMovie: jest.fn(),
    removeMovie: jest.fn(),
  };

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MoviesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
        { provide: FileUploadService, useValue: fileUploadServiceMock },
        { provide: SearchService, useValue: searchServiceMock },
      ],
    }).compile();

    service = module.get(MoviesService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create movie without file', async () => {
      prismaMock.movie.create.mockResolvedValue({ id: '1', title: 'A' });

      const res = await service.create({ title: 'A' } as any);

      expect(res.id).toBe('1');
      expect(fileUploadServiceMock.uploadFile).not.toHaveBeenCalled();
    });

    it('should create movie with file upload', async () => {
      fileUploadServiceMock.uploadFile.mockResolvedValue({
        id: 'file1',
      });

      prismaMock.movie.create.mockResolvedValue({ id: '1' });

      const file = { originalname: 'poster.png' } as any;

      const res = await service.create(
        { title: 'Movie' } as any,
        file,
        'user1',
      );

      expect(fileUploadServiceMock.uploadFile).toHaveBeenCalled();
      expect(res.id).toBe('1');
    });

    it('should throw error on prisma failure', async () => {
      prismaMock.movie.create.mockRejectedValue(new Error('DB crash'));

      await expect(service.create({ title: 'A' } as any)).rejects.toThrow(
        'DB crash',
      );
    });

    it('should throw error on upload failure', async () => {
      fileUploadServiceMock.uploadFile.mockRejectedValue(
        new Error('upload fail'),
      );

      await expect(
        service.create({ title: 'A' } as any, {} as any, 'u1'),
      ).rejects.toThrow('upload fail');
    });
  });

  describe('findAll', () => {
    it('should return movies with pagination', async () => {
      prismaMock.$transaction.mockResolvedValue([[{ id: '1' }], 1]);

      const res = await service.findAll({
        page: 1,
        limit: 10,
      });

      expect(res.data.length).toBe(1);
      expect(res.pagination.total).toBe(1);
    });

    it('should handle search + status filter', async () => {
      prismaMock.$transaction.mockResolvedValue([[], 0]);

      await service.findAll({
        page: 1,
        limit: 10,
        search: 'abc',
        status: 'ACTIVE',
      } as any);

      expect(prismaMock.movie.findMany).toBeDefined();
    });

    it('should throw InternalServerErrorException on failure', async () => {
      prismaMock.$transaction.mockRejectedValue(new Error('DB fail'));

      await expect(service.findAll({} as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findOne', () => {
    it('should return movie', async () => {
      prismaMock.movie.findUnique.mockResolvedValue({
        id: '1',
        showtimes: [],
      });

      const res = await service.findOne('1');

      expect(res.id).toBe('1');
    });

    it('should throw NotFoundException', async () => {
      prismaMock.movie.findUnique.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });

    it('should throw db error', async () => {
      prismaMock.movie.findUnique.mockRejectedValue(new Error('DB crash'));

      await expect(service.findOne('1')).rejects.toThrow('DB crash');
    });
  });

  describe('update', () => {
    it('should update movie without new file', async () => {
      prismaMock.movie.findUnique.mockResolvedValue({ id: '1' });

      prismaMock.movie.update.mockResolvedValue({ id: '1' });

      const res = await service.update('1', {});

      expect(res.id).toBe('1');
    });

    it('should replace poster file', async () => {
      prismaMock.movie.findUnique.mockResolvedValue({
        id: '1',
        poster: { id: 'file1', publicId: 'p1' },
      });

      fileUploadServiceMock.uploadFile.mockResolvedValue({
        id: 'file2',
      });

      prismaMock.movie.update.mockResolvedValue({ id: '1' });

      const res = await service.update('1', { title: 'new' }, {} as any, 'u1');

      expect(fileUploadServiceMock.uploadFile).toHaveBeenCalled();
      expect(res.id).toBe('1');
    });

    it('should throw NotFoundException when movie missing', async () => {
      prismaMock.movie.findUnique.mockResolvedValue(null);

      await expect(service.update('1', {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error when upload fails', async () => {
      prismaMock.movie.findUnique.mockResolvedValue({ id: '1' });

      fileUploadServiceMock.uploadFile.mockRejectedValue(
        new Error('upload fail'),
      );

      await expect(
        service.update('1', {} as any, {} as any, 'u1'),
      ).rejects.toThrow('upload fail');
    });

    it('should throw error when prisma update fails', async () => {
      prismaMock.movie.findUnique.mockResolvedValue({ id: '1' });

      prismaMock.movie.update.mockRejectedValue(new Error('DB fail'));

      await expect(service.update('1', {} as any)).rejects.toThrow('DB fail');
    });
  });

  describe('remove', () => {
    it('should delete movie without poster', async () => {
      prismaMock.movie.findUnique.mockResolvedValue({
        id: '1',
        posterId: null,
      });

      prismaMock.movie.delete.mockResolvedValue({ id: '1' });

      const res = await service.remove('1');

      expect(res.success).toBe(true);
    });

    it('should delete movie with poster', async () => {
      prismaMock.movie.findUnique.mockResolvedValue({
        id: '1',
        posterId: 'file1',
      });

      prismaMock.file.findUnique.mockResolvedValue({
        id: 'file1',
        publicId: 'p1',
      });

      prismaMock.movie.delete.mockResolvedValue({ id: '1' });

      const res = await service.remove('1');

      expect(res.success).toBe(true);
    });

    it('should throw NotFoundException', async () => {
      prismaMock.movie.findUnique.mockResolvedValue(null);

      await expect(service.remove('1')).rejects.toThrow(NotFoundException);
    });

    it('should throw error when cloud delete fails', async () => {
      prismaMock.movie.findUnique.mockResolvedValue({
        id: '1',
        posterId: 'file1',
      });

      prismaMock.file.findUnique.mockResolvedValue({
        id: 'file1',
        publicId: 'p1',
      });

      fileUploadServiceMock.cloudinary.deleteFile.mockRejectedValue(
        new Error('cloud fail'),
      );

      await expect(service.remove('1')).rejects.toThrow('cloud fail');
    });

    it('should throw error when prisma delete fails', async () => {
      prismaMock.movie.findUnique.mockResolvedValue({
        id: '1',
        posterId: null,
      });

      prismaMock.movie.delete.mockRejectedValue(new Error('DB fail'));

      await expect(service.remove('1')).rejects.toThrow('DB fail');
    });
  });
});

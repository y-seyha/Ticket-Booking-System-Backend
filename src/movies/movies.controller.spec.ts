import { Test } from '@nestjs/testing';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { ExecutionContext } from '@nestjs/common';

describe('MoviesController', () => {
  let controller: MoviesController;

  const moviesServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  // Mock guards → always allow
  const mockGuard = {
    canActivate: (context: ExecutionContext) => true,
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [MoviesController],
      providers: [{ provide: MoviesService, useValue: moviesServiceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get(MoviesController);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create movie', async () => {
      moviesServiceMock.create.mockResolvedValue({ id: '1' });

      const res = await controller.create(
        { originalname: 'file.png' } as any,
        { title: 'Movie' } as any,
        { id: 'user1' },
      );

      expect(moviesServiceMock.create).toHaveBeenCalled();
      expect(res.id).toBe('1');
    });

    it('should handle missing file', async () => {
      moviesServiceMock.create.mockResolvedValue({ id: '1' });

      const res = await controller.create(
        undefined as any,
        { title: 'Movie' } as any,
        { id: 'user1' },
      );

      expect(res.id).toBe('1');
    });

    it('should propagate service error', async () => {
      moviesServiceMock.create.mockRejectedValue(new Error('fail'));

      await expect(
        controller.create(undefined as any, {} as any, { id: 'u1' }),
      ).rejects.toThrow('fail');
    });
  });

  describe('findAll', () => {
    it('should return movies list', async () => {
      moviesServiceMock.findAll.mockResolvedValue({
        data: [{ id: '1' }],
        pagination: {},
      });

      const res = await controller.findAll({ page: 1, limit: 10 });

      expect(res.data.length).toBe(1);
    });

    it('should pass query correctly', async () => {
      moviesServiceMock.findAll.mockResolvedValue({ data: [] });

      await controller.findAll({
        page: 2,
        limit: 5,
        search: 'abc',
        status: 'ACTIVE',
      } as any);

      expect(moviesServiceMock.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          limit: 5,
        }),
      );
    });

    it('should handle service error', async () => {
      moviesServiceMock.findAll.mockRejectedValue(new Error('db fail'));

      await expect(controller.findAll({} as any)).rejects.toThrow('db fail');
    });
  });

  describe('findOne', () => {
    it('should return movie by id', async () => {
      moviesServiceMock.findOne.mockResolvedValue({ id: '1' });

      const res = await controller.findOne('1');

      expect(res.id).toBe('1');
    });

    it('should propagate not found', async () => {
      moviesServiceMock.findOne.mockRejectedValue(new Error('Movie not found'));

      await expect(controller.findOne('1')).rejects.toThrow('Movie not found');
    });
  });

  describe('update', () => {
    it('should update movie with file', async () => {
      moviesServiceMock.update.mockResolvedValue({ id: '1' });

      const res = await controller.update(
        '1',
        { originalname: 'file.png' } as any,
        { title: 'new' },
        { id: 'user1' },
      );

      expect(res.id).toBe('1');
    });

    it('should update movie without file', async () => {
      moviesServiceMock.update.mockResolvedValue({ id: '1' });

      const res = await controller.update(
        '1',
        undefined as any,
        { title: 'new' },
        { id: 'user1' },
      );

      expect(res.id).toBe('1');
    });

    it('should propagate error', async () => {
      moviesServiceMock.update.mockRejectedValue(new Error('fail'));

      await expect(
        controller.update('1', undefined as any, {} as any, { id: 'u1' }),
      ).rejects.toThrow('fail');
    });
  });

  describe('remove', () => {
    it('should delete movie', async () => {
      moviesServiceMock.remove.mockResolvedValue({
        success: true,
      });

      const res = await controller.remove('1');

      expect(res.success).toBe(true);
    });

    it('should propagate error', async () => {
      moviesServiceMock.remove.mockRejectedValue(new Error('fail'));

      await expect(controller.remove('1')).rejects.toThrow('fail');
    });
  });
});

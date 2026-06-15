import { Test, TestingModule } from '@nestjs/testing';
import { TheaterController } from './theater.controller';
import { TheaterService } from './theater.service';
import { Role } from '@prisma/client';

describe('TheaterController', () => {
  let controller: TheaterController;

  const theaterService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockFile = {
    originalname: 'test.jpg',
  } as Express.Multer.File;

  const mockUser = {
    id: 'user-1',
    role: Role.ADMIN,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TheaterController],
      providers: [
        { provide: TheaterService, useValue: theaterService },
      ],
    }).compile();

    controller = module.get(TheaterController);
  });

  describe('create', () => {
    it('should call service.create with dto, file, userId', async () => {
      theaterService.create.mockResolvedValue({ id: '1' });

      const dto = { name: 'Cinema 1' } as any;

      const result = await controller.create(mockFile, dto, mockUser);

      expect(theaterService.create).toHaveBeenCalledWith(
          dto,
          mockFile,
          mockUser.id,
      );

      expect(result).toEqual({ id: '1' });
    });

    it('should work without file', async () => {
      theaterService.create.mockResolvedValue({ id: '1' });

      const dto = { name: 'Cinema 1' } as any;

      const result = await controller.create(undefined as any, dto, mockUser);

      expect(theaterService.create).toHaveBeenCalledWith(
          dto,
          undefined,
          mockUser.id,
      );

      expect(result.id).toBe('1');
    });
  });

  describe('findAll', () => {
    it('should pass query to service', async () => {
      const query = { page: 1, limit: 10 };

      theaterService.findAll.mockResolvedValue({ data: [], pagination: {} });

      await controller.findAll(query as any);

      expect(theaterService.findAll).toHaveBeenCalledWith(query);
    });

    it('should return service result', async () => {
      const response = {
        data: [{ id: '1' }],
        pagination: { total: 1 },
      };

      theaterService.findAll.mockResolvedValue(response);

      const result = await controller.findAll({} as any);

      expect(result).toEqual(response);
    });
  });

  describe('findOne', () => {
    it('should call service with id', async () => {
      theaterService.findOne.mockResolvedValue({ id: '1' });

      const result = await controller.findOne('1');

      expect(theaterService.findOne).toHaveBeenCalledWith('1');
      expect(result.id).toBe('1');
    });
  });

  describe('update', () => {
    it('should call update with id, dto, file, userId', async () => {
      theaterService.update.mockResolvedValue({ id: '1' });

      const dto = { name: 'Updated' } as any;

      const result = await controller.update(
          '1',
          dto,
          mockFile,
          mockUser,
      );

      expect(theaterService.update).toHaveBeenCalledWith(
          '1',
          dto,
          mockFile,
          mockUser.id,
      );

      expect(result.id).toBe('1');
    });

    it('should handle update without file', async () => {
      theaterService.update.mockResolvedValue({ id: '1' });

      const dto = { name: 'Updated' } as any;

      await controller.update('1', dto, undefined as any, mockUser);

      expect(theaterService.update).toHaveBeenCalledWith(
          '1',
          dto,
          undefined,
          mockUser.id,
      );
    });
  });

  describe('remove', () => {
    it('should call service.remove', async () => {
      theaterService.remove.mockResolvedValue({
        success: true,
      });

      const result = await controller.remove('1');

      expect(theaterService.remove).toHaveBeenCalledWith('1');
      expect(result.success).toBe(true);
    });
  });
});
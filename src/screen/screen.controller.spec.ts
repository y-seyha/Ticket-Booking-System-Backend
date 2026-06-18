import { Test, TestingModule } from '@nestjs/testing';
import { ScreenController } from './screen.controller';
import { ScreenService } from './screen.service';
import { CreateScreenDto } from './dto/create-screen.dto';
import { UpdateScreenDto } from './dto/update-screen.dto';
import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

describe('ScreenController', () => {
  let controller: ScreenController;
  let service: ScreenService;

  const mockScreenService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScreenController],
      providers: [
        {
          provide: ScreenService,
          useValue: mockScreenService,
        },
      ],
    }).compile();

    controller = module.get<ScreenController>(ScreenController);
    service = module.get<ScreenService>(ScreenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create screen successfully', async () => {
      const dto: CreateScreenDto = {
        name: 'Screen 1',
        capacity: 100,
      } as any;

      const result = { id: '1', ...dto };

      mockScreenService.create.mockResolvedValue(result);

      expect(await controller.create(dto)).toEqual(result);
    });

    it('should throw BadRequestException', async () => {
      const dto = {} as CreateScreenDto;

      mockScreenService.create.mockRejectedValue(
        new BadRequestException('Invalid screen data'),
      );

      await expect(controller.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException', async () => {
      const dto = { name: 'Screen' } as CreateScreenDto;

      mockScreenService.create.mockRejectedValue(
        new InternalServerErrorException(),
      );

      await expect(controller.create(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all screens', async () => {
      const result = [
        { id: '1', name: 'Screen 1' },
        { id: '2', name: 'Screen 2' },
      ];

      mockScreenService.findAll.mockResolvedValue(result);

      expect(await controller.findAll()).toEqual(result);
    });

    it('should throw InternalServerErrorException', async () => {
      mockScreenService.findAll.mockRejectedValue(
        new InternalServerErrorException(),
      );

      await expect(controller.findAll()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a screen by id', async () => {
      const result = { id: '1', name: 'Screen 1' };

      mockScreenService.findOne.mockResolvedValue(result);

      expect(await controller.findOne('1')).toEqual(result);
    });

    it('should throw NotFoundException', async () => {
      mockScreenService.findOne.mockRejectedValue(
        new NotFoundException('Screen not found'),
      );

      await expect(controller.findOne('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update screen successfully', async () => {
      const dto: UpdateScreenDto = { name: 'Updated Screen' };
      const result = { id: '1', ...dto };

      mockScreenService.update.mockResolvedValue(result);

      expect(await controller.update('1', dto)).toEqual(result);
    });

    it('should throw NotFoundException', async () => {
      mockScreenService.update.mockRejectedValue(
        new NotFoundException('Screen not found'),
      );

      await expect(controller.update('999', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException', async () => {
      mockScreenService.update.mockRejectedValue(
        new BadRequestException('Invalid update data'),
      );

      await expect(controller.update('1', {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('should delete screen successfully', async () => {
      mockScreenService.remove.mockResolvedValue({
        message: 'Deleted successfully',
      });

      expect(await controller.remove('1')).toEqual({
        message: 'Deleted successfully',
      });
    });

    it('should throw NotFoundException', async () => {
      mockScreenService.remove.mockRejectedValue(
        new NotFoundException('Screen not found'),
      );

      await expect(controller.remove('999')).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException', async () => {
      mockScreenService.remove.mockRejectedValue(
        new InternalServerErrorException(),
      );

      await expect(controller.remove('1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});

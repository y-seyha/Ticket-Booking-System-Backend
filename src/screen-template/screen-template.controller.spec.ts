import { Test, TestingModule } from '@nestjs/testing';
import { ScreenTemplateController } from './screen-template.controller';
import { ScreenTemplateService } from './screen-template.service';
import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

describe('ScreenTemplateController', () => {
  let controller: ScreenTemplateController;
  let service: ScreenTemplateService;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScreenTemplateController],
      providers: [
        {
          provide: ScreenTemplateService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get(ScreenTemplateController);
    service = module.get(ScreenTemplateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create template successfully', async () => {
      const dto = {
        name: 'Template A',
      } as any;

      const result = { id: '1', ...dto };

      mockService.create.mockResolvedValue(result);

      expect(await controller.create(dto)).toEqual(result);
    });

    it('should throw BadRequestException', async () => {
      const dto = {} as any;

      mockService.create.mockRejectedValue(
          new BadRequestException('Invalid template data'),
      );

      await expect(controller.create(dto)).rejects.toThrow(
          BadRequestException,
      );
    });

    it('should throw InternalServerErrorException', async () => {
      const dto = { name: 'Template A' } as any;

      mockService.create.mockRejectedValue(
          new InternalServerErrorException(),
      );

      await expect(controller.create(dto)).rejects.toThrow(
          InternalServerErrorException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all templates', async () => {
      const result = [
        { id: '1', name: 'T1' },
        { id: '2', name: 'T2' },
      ];

      mockService.findAll.mockResolvedValue(result);

      expect(await controller.findAll()).toEqual(result);
    });

    it('should throw InternalServerErrorException', async () => {
      mockService.findAll.mockRejectedValue(
          new InternalServerErrorException(),
      );

      await expect(controller.findAll()).rejects.toThrow(
          InternalServerErrorException,
      );
    });
  });

  describe('findOne', () => {
    it('should return template by id', async () => {
      const result = { id: '1', name: 'Template A' };

      mockService.findOne.mockResolvedValue(result);

      expect(await controller.findOne('1')).toEqual(result);
    });

    it('should throw NotFoundException', async () => {
      mockService.findOne.mockRejectedValue(
          new NotFoundException('Template not found'),
      );

      await expect(controller.findOne('999')).rejects.toThrow(
          NotFoundException,
      );
    });

    it('should handle empty id', async () => {
      mockService.findOne.mockRejectedValue(
          new BadRequestException('ID is required'),
      );

      await expect(controller.findOne('')).rejects.toThrow(
          BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('should update template successfully', async () => {
      const dto = { name: 'Updated Template' } as any;
      const result = { id: '1', ...dto };

      mockService.update.mockResolvedValue(result);

      expect(await controller.update('1', dto)).toEqual(result);
    });

    it('should throw NotFoundException', async () => {
      mockService.update.mockRejectedValue(
          new NotFoundException('Template not found'),
      );

      await expect(
          controller.update('999', {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException', async () => {
      mockService.update.mockRejectedValue(
          new BadRequestException('Invalid update data'),
      );

      await expect(
          controller.update('1', {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException', async () => {
      mockService.update.mockRejectedValue(
          new InternalServerErrorException(),
      );

      await expect(
          controller.update('1', {} as any),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('remove', () => {
    it('should delete template successfully', async () => {
      mockService.remove.mockResolvedValue({
        message: 'Deleted successfully',
      });

      expect(await controller.remove('1')).toEqual({
        message: 'Deleted successfully',
      });
    });

    it('should throw NotFoundException', async () => {
      mockService.remove.mockRejectedValue(
          new NotFoundException('Template not found'),
      );

      await expect(controller.remove('999')).rejects.toThrow(
          NotFoundException,
      );
    });

    it('should throw BadRequestException', async () => {
      mockService.remove.mockRejectedValue(
          new BadRequestException('Invalid ID'),
      );

      await expect(controller.remove('')).rejects.toThrow(
          BadRequestException,
      );
    });

    it('should throw InternalServerErrorException', async () => {
      mockService.remove.mockRejectedValue(
          new InternalServerErrorException(),
      );

      await expect(controller.remove('1')).rejects.toThrow(
          InternalServerErrorException,
      );
    });
  });
});
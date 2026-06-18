import { Test, TestingModule } from '@nestjs/testing';
import { SeatTemplateController } from './seat-template.controller';
import { SeatTemplateService } from './seat-template.service';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

describe('SeatTemplateController', () => {
  let controller: SeatTemplateController;
  let service: SeatTemplateService;

  const mockService = {
    generateBulk: jest.fn(),
    findAll: jest.fn(),
    findByTemplate: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeatTemplateController],
      providers: [
        {
          provide: SeatTemplateService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get(SeatTemplateController);
    service = module.get(SeatTemplateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generate', () => {
    it('should generate template seats successfully', async () => {
      const dto = {
        templateId: '1',
        rows: 5,
        columns: 10,
      } as any;

      const result = { success: true, count: 50 };

      mockService.generateBulk.mockResolvedValue(result);

      expect(await controller.generate(dto)).toEqual(result);
    });

    it('should throw BadRequestException when dto invalid', async () => {
      const dto = {} as any;

      mockService.generateBulk.mockRejectedValue(
        new BadRequestException('Invalid template data'),
      );

      await expect(controller.generate(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException', async () => {
      const dto = { templateId: '1' } as any;

      mockService.generateBulk.mockRejectedValue(
        new InternalServerErrorException(),
      );

      await expect(controller.generate(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all template seats', async () => {
      const result = [{ id: '1' }, { id: '2' }];

      mockService.findAll.mockResolvedValue(result);

      expect(await controller.findAll()).toEqual(result);
    });

    it('should throw InternalServerErrorException', async () => {
      mockService.findAll.mockRejectedValue(new InternalServerErrorException());

      await expect(controller.findAll()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findByTemplate', () => {
    it('should return seats by template id', async () => {
      const result = [
        { id: '1', templateId: 't1' },
        { id: '2', templateId: 't1' },
      ];

      mockService.findByTemplate.mockResolvedValue(result);

      expect(await controller.findByTemplate('t1')).toEqual(result);
    });

    it('should throw NotFoundException', async () => {
      mockService.findByTemplate.mockRejectedValue(
        new NotFoundException('Template not found'),
      );

      await expect(controller.findByTemplate('999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle empty templateId', async () => {
      mockService.findByTemplate.mockRejectedValue(
        new BadRequestException('templateId is required'),
      );

      await expect(controller.findByTemplate('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findOne', () => {
    it('should return template seat by id', async () => {
      const result = { id: '1', row: 1, column: 1 };

      mockService.findOne.mockResolvedValue(result);

      expect(await controller.findOne('1')).toEqual(result);
    });

    it('should throw NotFoundException', async () => {
      mockService.findOne.mockRejectedValue(
        new NotFoundException('Seat not found'),
      );

      await expect(controller.findOne('999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for empty id', async () => {
      mockService.findOne.mockRejectedValue(
        new BadRequestException('ID is required'),
      );

      await expect(controller.findOne('')).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException', async () => {
      mockService.findOne.mockRejectedValue(new InternalServerErrorException());

      await expect(controller.findOne('1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});

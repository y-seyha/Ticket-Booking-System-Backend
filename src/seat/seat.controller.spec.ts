import { Test, TestingModule } from '@nestjs/testing';
import { SeatController } from './seat.controller';
import { SeatService } from './seat.service';
import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

describe('SeatController', () => {
  let controller: SeatController;

  const mockService = {
    getSeatsByScreen: jest.fn(),
    getSeatMap: jest.fn(),
    lockSeat: jest.fn(),
    unlockSeat: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeatController],
      providers: [
        {
          provide: SeatService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get(SeatController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getSeats', () => {
    it('should return seats by screen', async () => {
      mockService.getSeatsByScreen.mockResolvedValue([{ id: '1' }]);

      expect(await controller.getSeats('screen-1')).toEqual([{ id: '1' }]);
    });

    it('should throw InternalServerErrorException', async () => {
      mockService.getSeatsByScreen.mockRejectedValue(
        new InternalServerErrorException(),
      );

      await expect(controller.getSeats('screen-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getSeatMap', () => {
    it('should return seat map', async () => {
      mockService.getSeatMap.mockResolvedValue([
        { id: '1', isLocked: false, isBooked: false },
      ]);

      expect(await controller.getSeatMap('show-1')).toHaveLength(1);
    });

    it('should throw NotFoundException', async () => {
      mockService.getSeatMap.mockRejectedValue(new NotFoundException());

      await expect(controller.getSeatMap('bad')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException', async () => {
      mockService.getSeatMap.mockRejectedValue(
        new InternalServerErrorException(),
      );

      await expect(controller.getSeatMap('show-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('lockSeat', () => {
    const dto = {
      seatId: 'seat-1',
      showtimeId: 'show-1',
    } as any;

    const user = { id: 'user-1' };

    it('should lock seat successfully', async () => {
      const result = { message: 'Seat locked' };

      mockService.lockSeat.mockResolvedValue(result);

      expect(await controller.lockSeat(user as any, dto)).toEqual(result);

      expect(mockService.lockSeat).toHaveBeenCalledWith('user-1', dto);
    });

    it('should throw BadRequestException', async () => {
      mockService.lockSeat.mockRejectedValue(new BadRequestException());

      await expect(controller.lockSeat(user as any, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException', async () => {
      mockService.lockSeat.mockRejectedValue(new NotFoundException());

      await expect(controller.lockSeat(user as any, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException', async () => {
      mockService.lockSeat.mockRejectedValue(
        new InternalServerErrorException(),
      );

      await expect(controller.lockSeat(user as any, dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should fail if user is missing', () => {
      expect(() => controller.lockSeat(undefined as any, dto)).toThrow();
    });
  });

  describe('unlockSeat', () => {
    const req = { user: { id: 'user-1' } };

    it('should unlock seat successfully', async () => {
      mockService.unlockSeat.mockResolvedValue({
        message: 'Unlocked',
      });

      expect(
        await controller.unlockSeat(req as any, 'show-1', 'seat-1'),
      ).toEqual({ message: 'Unlocked' });

      expect(mockService.unlockSeat).toHaveBeenCalledWith(
        'user-1',
        'seat-1',
        'show-1',
      );
    });

    it('should throw NotFoundException', async () => {
      mockService.unlockSeat.mockRejectedValue(new NotFoundException());

      await expect(
        controller.unlockSeat(req as any, 'show-1', 'seat-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException', async () => {
      mockService.unlockSeat.mockRejectedValue(new BadRequestException());

      await expect(
        controller.unlockSeat(req as any, 'show-1', 'seat-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException', async () => {
      mockService.unlockSeat.mockRejectedValue(
        new InternalServerErrorException(),
      );

      await expect(
        controller.unlockSeat(req as any, 'show-1', 'seat-1'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});

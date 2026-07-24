import { Test, TestingModule } from '@nestjs/testing';
import { SeatService } from './seat.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

describe('SeatService', () => {
  let service: SeatService;

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
  };

  const mockPrisma = {
    seat: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    showtime: {
      findUnique: jest.fn(),
    },
    seatLock: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeatService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(SeatService);
    (service as any).logger = mockLogger;
  });

  describe('getSeatsByScreen', () => {
    it('should return seats sorted', async () => {
      const data = [{ id: '1' }];
      mockPrisma.seat.findMany.mockResolvedValue(data);

      const result = await service.getSeatsByScreen('s1');

      expect(result).toEqual(data);
      expect(mockPrisma.seat.findMany).toHaveBeenCalledWith({
        where: { screenId: 's1' },
        orderBy: [{ seatRow: 'asc' }, { seatNumber: 'asc' }],
      });
    });

    it('should handle prisma failure', async () => {
      mockPrisma.seat.findMany.mockRejectedValue(new Error('DB fail'));

      await expect(service.getSeatsByScreen('s1')).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle undefined error safely', async () => {
      mockPrisma.seat.findMany.mockRejectedValue(undefined);

      await expect(service.getSeatsByScreen('s1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getSeatMap', () => {
    const now = new Date();

    it('should return seat map with isLocked and isBooked flags', async () => {
      mockPrisma.showtime.findUnique.mockResolvedValue({
        id: 'st1',
        screen: {
          seats: [{ id: 's1' }, { id: 's2' }],
        },
        seatLocks: [
          {
            seatId: 's1',
            expiresAt: new Date(now.getTime() + 100000),
          },
        ],
        bookingSeats: [{ seatId: 's2' }],
      });

      const result = await service.getSeatMap('st1');

      const s1 = result.find((s) => s.id === 's1');
      const s2 = result.find((s) => s.id === 's2');

      expect(s1).toBeDefined();
      expect(s2).toBeDefined();

      expect(s1!.status).toBe('LOCKED');
      expect(s2!.status).toBe('BOOKED');
    });

    it('should filter expired locks', async () => {
      mockPrisma.showtime.findUnique.mockResolvedValue({
        screen: { seats: [{ id: 's1' }] },
        seatLocks: [
          {
            seatId: 's1',
            expiresAt: new Date(now.getTime() - 100000),
          },
        ],
        bookingSeats: [],
      });

      const result = await service.getSeatMap('st1');

      expect(result[0].status).toBe('AVAILABLE');
    });

    it('should throw NotFoundException when showtime missing', async () => {
      mockPrisma.showtime.findUnique.mockResolvedValue(null);

      await expect(service.getSeatMap('st1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle prisma crash', async () => {
      mockPrisma.showtime.findUnique.mockRejectedValue(new Error('DB crash'));

      await expect(service.getSeatMap('st1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('lockSeat', () => {
    const dto = {
      seatId: 's1',
      showtimeId: 'st1',
    };

    it('should lock seat successfully', async () => {
      mockPrisma.seat.findUnique.mockResolvedValue({ id: 's1' });
      mockPrisma.showtime.findUnique.mockResolvedValue({ id: 'st1' });

      mockPrisma.seatLock.findUnique.mockResolvedValue(null);

      mockPrisma.seatLock.create.mockResolvedValue({
        id: 'lock1',
      });

      const result = await service.lockSeat('acc1', dto);

      expect(result.message).toBe('Seat locked successfully');
      expect(mockPrisma.seatLock.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if seat missing', async () => {
      mockPrisma.seat.findUnique.mockResolvedValue(null);

      await expect(service.lockSeat('acc1', dto as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if showtime missing', async () => {
      mockPrisma.seat.findUnique.mockResolvedValue({ id: 's1' });
      mockPrisma.showtime.findUnique.mockResolvedValue(null);

      await expect(service.lockSeat('acc1', dto as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should block already locked seat', async () => {
      mockPrisma.seat.findUnique.mockResolvedValue({ id: 's1' });
      mockPrisma.showtime.findUnique.mockResolvedValue({ id: 'st1' });

      mockPrisma.seatLock.findUnique.mockResolvedValue({
        expiresAt: new Date(Date.now() + 10000),
      });

      await expect(service.lockSeat('acc1', dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow expired lock overwrite', async () => {
      mockPrisma.seat.findUnique.mockResolvedValue({ id: 's1' });
      mockPrisma.showtime.findUnique.mockResolvedValue({ id: 'st1' });

      mockPrisma.seatLock.findUnique.mockResolvedValue({
        expiresAt: new Date(Date.now() - 10000),
      });

      mockPrisma.seatLock.create.mockResolvedValue({ id: 'lock2' });

      const result = await service.lockSeat('acc1', dto);

      expect(result.message).toBe('Seat locked successfully');
    });

    it('should handle prisma crash', async () => {
      mockPrisma.seat.findUnique.mockRejectedValue(new Error('DB fail'));

      await expect(service.lockSeat('acc1', dto as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('unlockSeat', () => {
    it('should unlock seat successfully', async () => {
      mockPrisma.seatLock.findUnique.mockResolvedValue({
        id: 'lock1',
        accountId: 'acc1',
      });

      mockPrisma.seatLock.delete.mockResolvedValue({});

      const result = await service.unlockSeat('acc1', 's1', 'st1');

      expect(result.message).toBe('Seat unlocked');
    });

    it('should throw NotFoundException if lock missing', async () => {
      mockPrisma.seatLock.findUnique.mockResolvedValue(null);

      await expect(service.unlockSeat('acc1', 's1', 'st1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if not owner', async () => {
      mockPrisma.seatLock.findUnique.mockResolvedValue({
        id: 'lock1',
        accountId: 'other-user',
      });

      await expect(service.unlockSeat('acc1', 's1', 'st1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle prisma crash', async () => {
      mockPrisma.seatLock.findUnique.mockRejectedValue(new Error('DB fail'));

      await expect(service.unlockSeat('acc1', 's1', 'st1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('cleanupExpiredLocks', () => {
    it('should delete expired locks and log count', async () => {
      mockPrisma.seatLock.findMany.mockResolvedValue([
        {
          id: 'l1',
          showtimeId: 'st1',
          seatId: 's1',
          accountId: 'acc1',
          expiresAt: new Date(Date.now() - 10000),
        },
        {
          id: 'l2',
          showtimeId: 'st1',
          seatId: 's2',
          accountId: 'acc2',
          expiresAt: new Date(Date.now() - 5000),
        },
      ]);
      mockPrisma.seatLock.deleteMany.mockResolvedValue({ count: 2 });

      await service.cleanupExpiredLocks();

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Removed 2'),
      );
    });

    it('should handle cleanup failure', async () => {
      mockPrisma.seatLock.deleteMany.mockRejectedValue(new Error('fail'));

      await expect(service.cleanupExpiredLocks()).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});

import { Test } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException, InternalServerErrorException, Logger,
} from '@nestjs/common';
import { AccountStatus, Role } from '@prisma/client';

describe('UserService', () => {
  let service: UserService;

  const prismaMock = {
    account: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    userProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(UserService);
    jest.clearAllMocks();
  });

  describe('getMyProfile', () => {
    it('should return user profile', async () => {
      prismaMock.account.findUnique.mockResolvedValue({
        id: '1',
        profile: {},
      });

      const result = await service.getMyProfile('1');
      expect(result.id).toBe('1');
    });

    it('should throw NotFoundException', async () => {
      prismaMock.account.findUnique.mockResolvedValue(null);

      await expect(service.getMyProfile('1')).rejects.toThrow(
          NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('success', async () => {
      prismaMock.userProfile.findUnique.mockResolvedValue({ accountId: '1' });

      prismaMock.userProfile.update.mockResolvedValue({
        firstName: 'a',
      });

      const res = await service.updateProfile('1', {
        firstName: 'a',
      } as any);

      expect(res.firstName).toBe('a');
    });

    it('profile not found', async () => {
      prismaMock.userProfile.findUnique.mockResolvedValue(null);

      await expect(
          service.updateProfile('1', {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerError on unknown error', async () => {
      prismaMock.userProfile.findUnique.mockRejectedValue(
          new Error('DB crash'),
      );

      await expect(
          service.updateProfile('1', {} as any),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('disableAccount', () => {
    it('success delete', async () => {
      prismaMock.account.findUnique.mockResolvedValue({
        id: '1',
        status: AccountStatus.ACTIVE,
      });

      prismaMock.account.update.mockResolvedValue({
        id: '1',
        status: AccountStatus.DELETED,
      });

      const res = await service.disableAccount('1');
      expect(res.status).toBe(AccountStatus.DELETED);
    });

    it('already deleted', async () => {
      prismaMock.account.findUnique.mockResolvedValue({
        id: '1',
        status: AccountStatus.DELETED,
      });

      await expect(service.disableAccount('1')).rejects.toThrow(
          BadRequestException,
      );
    });

    it('not found', async () => {
      prismaMock.account.findUnique.mockResolvedValue(null);

      await expect(service.disableAccount('1')).rejects.toThrow(
          NotFoundException,
      );
    });
  });

  describe('banUser', () => {
    it('cannot ban self', async () => {
      await expect(service.banUser('1', '1')).rejects.toThrow(
          BadRequestException,
      );
    });

    it('not found', async () => {
      prismaMock.account.findUnique.mockResolvedValue(null);

      await expect(service.banUser('2', '1')).rejects.toThrow(
          NotFoundException,
      );
    });

    it('cannot ban admin', async () => {
      prismaMock.account.findUnique.mockResolvedValue({
        id: '2',
        role: Role.ADMIN,
      });

      await expect(service.banUser('2', '1')).rejects.toThrow(
          ForbiddenException,
      );
    });

    it('already banned', async () => {
      prismaMock.account.findUnique.mockResolvedValue({
        id: '2',
        role: Role.USER,
        status: AccountStatus.SUSPENDED,
      });

      await expect(service.banUser('2', '1')).rejects.toThrow(
          BadRequestException,
      );
    });
  });

  describe('changeRole', () => {
    it('cannot change own role', async () => {
      await expect(
          service.changeRole('1', Role.ADMIN, '1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('user not found', async () => {
      prismaMock.account.findUnique.mockResolvedValue(null);

      await expect(
          service.changeRole('2', Role.ADMIN, '1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('success role change', async () => {
      prismaMock.account.findUnique.mockResolvedValue({ id: '2' });
      prismaMock.account.update.mockResolvedValue({
        id: '2',
        role: Role.ADMIN,
      });

      const res = await service.changeRole('2', Role.ADMIN, '1');
      expect(res.role).toBe(Role.ADMIN);
    });
  });

  describe('getAllUsers', () => {
    it('success', async () => {
      prismaMock.account.findMany.mockResolvedValue([{ id: '1' }]);
      prismaMock.account.count.mockResolvedValue(1);

      const res = await service.getAllUsers(1, 10);
      expect(res.length).toBe(1);
    });

    it('db error', async () => {
      prismaMock.account.findMany.mockRejectedValue(new Error());

      await expect(service.getAllUsers()).rejects.toThrow(
          InternalServerErrorException,
      );
    });
  });

  describe('unbanUser', () => {
    it('success', async () => {
      prismaMock.account.update.mockResolvedValue({
        id: '1',
        status: AccountStatus.ACTIVE,
      });

      const res = await service.unbanUser('1');
      expect(res.status).toBe(AccountStatus.ACTIVE);
    });

    it('error', async () => {
      prismaMock.account.update.mockRejectedValue(new Error());

      await expect(service.unbanUser('1')).rejects.toThrow(
          InternalServerErrorException,
      );
    });
  });

  describe('getMyProfile - extra', () => {
    it('should log and rethrow unexpected error', async () => {
      prismaMock.account.findUnique.mockRejectedValue(new Error('DB crash'));

      await expect(service.getMyProfile('1')).rejects.toThrow('DB crash');
    });
  });

  describe('getMyProfile - extra', () => {
    it('should log and rethrow unexpected error', async () => {
      prismaMock.account.findUnique.mockRejectedValue(new Error('DB crash'));

      await expect(service.getMyProfile('1')).rejects.toThrow('DB crash');
    });
  });

  describe('disableAccount - extra', () => {
    it('should handle prisma update failure', async () => {
      prismaMock.account.findUnique.mockResolvedValue({
        id: '1',
        status: AccountStatus.ACTIVE,
      });

      prismaMock.account.update.mockRejectedValue(new Error('DB fail'));

      await expect(service.disableAccount('1')).rejects.toThrow(
          InternalServerErrorException,
      );
    });

    it('should log and throw when account missing profile relation (safe case)', async () => {
      prismaMock.account.findUnique.mockResolvedValue(null);

      await expect(service.disableAccount('1')).rejects.toThrow(
          NotFoundException,
      );
    });
  });


  describe('banUser - extra', () => {
    it('should handle prisma update failure', async () => {
      prismaMock.account.findUnique.mockResolvedValue({
        id: '2',
        role: Role.USER,
        status: AccountStatus.ACTIVE,
      });

      prismaMock.account.update.mockRejectedValue(new Error('DB fail'));

      await expect(service.banUser('2', '1')).rejects.toThrow(
          InternalServerErrorException,
      );
    });

    it('should allow banning normal user successfully', async () => {
      prismaMock.account.findUnique.mockResolvedValue({
        id: '2',
        role: Role.USER,
        status: AccountStatus.ACTIVE,
      });

      prismaMock.account.update.mockResolvedValue({
        id: '2',
        status: AccountStatus.SUSPENDED,
      });

      const res = await service.banUser('2', '1');

      expect(res.status).toBe(AccountStatus.SUSPENDED);
    });
  });

  describe('changeRole - extra', () => {
    it('should handle prisma update error', async () => {
      prismaMock.account.findUnique.mockResolvedValue({ id: '2' });
      prismaMock.account.update.mockRejectedValue(new Error('DB fail'));

      await expect(
          service.changeRole('2', Role.ADMIN, '1'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should allow downgrade role', async () => {
      prismaMock.account.findUnique.mockResolvedValue({ id: '2' });
      prismaMock.account.update.mockResolvedValue({
        id: '2',
        role: Role.USER,
      });

      const res = await service.changeRole('2', Role.USER, '1');

      expect(res.role).toBe(Role.USER);
    });
  });

  describe('getAllUsers - extra', () => {
    it('should handle page=0 safely', async () => {
      prismaMock.account.findMany.mockResolvedValue([]);
      prismaMock.account.count.mockResolvedValue(0);

      const res = await service.getAllUsers(0, 10);

      expect(res).toEqual([]);
    });

    it('should handle large pagination values', async () => {
      prismaMock.account.findMany.mockResolvedValue([{ id: '1' }]);
      prismaMock.account.count.mockResolvedValue(1);

      const res = await service.getAllUsers(999, 999);

      expect(res.length).toBe(1);
    });
  });

  describe('unbanUser - extra', () => {
    it('should handle prisma failure', async () => {
      prismaMock.account.update.mockRejectedValue(new Error('DB fail'));

      await expect(service.unbanUser('1')).rejects.toThrow(
          InternalServerErrorException,
      );
    });
  });

  describe('deleteUser', () => {
    it('should prevent self deletion', async () => {
      await expect(service.deleteUser('1', '1')).rejects.toThrow(
          BadRequestException,
      );
    });

    it('should delete user successfully', async () => {
      prismaMock.account.update.mockResolvedValue({
        id: '2',
        status: AccountStatus.DELETED,
      });

      const res = await service.deleteUser('2', '1');

      expect(res.status).toBe(AccountStatus.DELETED);
    });

    it('should handle DB error', async () => {
      prismaMock.account.update.mockRejectedValue(new Error('DB crash'));

      await expect(service.deleteUser('2', '1')).rejects.toThrow(
          InternalServerErrorException,
      );
    });
  });
});
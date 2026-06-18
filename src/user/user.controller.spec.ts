import { Test } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { Role } from '@prisma/client';

describe('UserController', () => {
  let controller: UserController;

  const userServiceMock = {
    getMyProfile: jest.fn(),
    updateProfile: jest.fn(),
    disableAccount: jest.fn(),
    getAllUsers: jest.fn(),
    getUserById: jest.fn(),
    banUser: jest.fn(),
    unbanUser: jest.fn(),
    changeRole: jest.fn(),
    deleteUser: jest.fn(),
  };

  const mockUser = {
    id: 'user-1',
    role: Role.ADMIN,
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: userServiceMock }],
    }).compile();

    controller = module.get(UserController);
    jest.clearAllMocks();
  });

  describe('GET /users/me', () => {
    it('should return current user profile', async () => {
      userServiceMock.getMyProfile.mockResolvedValue({
        id: 'user-1',
        profile: {},
      });

      const res = await controller.getMyProfile(mockUser);

      expect(userServiceMock.getMyProfile).toHaveBeenCalledWith('user-1');
      expect(res.id).toBe('user-1');
    });

    it('should propagate service error', async () => {
      userServiceMock.getMyProfile.mockRejectedValue(new Error('profile fail'));

      await expect(controller.getMyProfile(mockUser)).rejects.toThrow(
        'profile fail',
      );
    });
  });

  describe('PATCH /users/me', () => {
    it('should update profile', async () => {
      userServiceMock.updateProfile.mockResolvedValue({
        firstName: 'John',
      });

      const res = await controller.updateMyProfile(
        mockUser,
        { firstName: 'John' },
        undefined,
      );

      expect(userServiceMock.updateProfile).toHaveBeenCalledWith(
        'user-1',
        { firstName: 'John' },
        undefined,
      );

      expect(res.firstName).toBe('John');
    });

    it('should update profile with avatar', async () => {
      const mockFile = {
        originalname: 'avatar.png',
        mimetype: 'image/png',
        filename: 'avatar.png',
      } as Express.Multer.File;

      userServiceMock.updateProfile.mockResolvedValue({
        firstName: 'John',
        avatarId: 'file-123',
      });

      const res = await controller.updateMyProfile(
        mockUser,
        { firstName: 'John' },
        mockFile,
      );

      expect(userServiceMock.updateProfile).toHaveBeenCalledWith(
        'user-1',
        { firstName: 'John' },
        mockFile,
      );

      expect(res.avatarId).toBe('file-123');
    });

    describe('PATCH /users/:id/role', () => {
      it('should propagate invalid role error', async () => {
        userServiceMock.changeRole.mockRejectedValue(new Error('Invalid role'));

        await expect(
          controller.changeRole('3', 'INVALID' as any, mockUser),
        ).rejects.toThrow('Invalid role');
      });
    });
  });

  describe('DELETE /users/me', () => {
    it('should disable account', async () => {
      userServiceMock.disableAccount.mockResolvedValue({
        id: 'user-1',
        status: 'DELETED',
      });

      const res = await controller.disableMyAccount(mockUser);

      expect(userServiceMock.disableAccount).toHaveBeenCalledWith('user-1');
      expect(res.status).toBe('DELETED');
    });
  });

  describe('GET /users', () => {
    it('should return users with default pagination', async () => {
      userServiceMock.getAllUsers.mockResolvedValue([{ id: '1' }]);

      const res = await controller.getAllUsers(undefined, undefined);

      expect(userServiceMock.getAllUsers).toHaveBeenCalledWith(1, 10);
      expect(res.length).toBe(1);
    });

    it('should convert query params to numbers', async () => {
      userServiceMock.getAllUsers.mockResolvedValue([]);

      await controller.getAllUsers('10' as any, '20' as any);

      expect(userServiceMock.getAllUsers).toHaveBeenCalledWith(10, 20);
    });

    it('should parse pagination strings', async () => {
      userServiceMock.getAllUsers.mockResolvedValue([]);

      await controller.getAllUsers('2' as any, '5' as any);

      expect(userServiceMock.getAllUsers).toHaveBeenCalledWith(2, 5);
    });

    it('should handle NaN pagination safely', async () => {
      userServiceMock.getAllUsers.mockResolvedValue([]);

      await controller.getAllUsers('abc' as any, 'xyz' as any);

      expect(userServiceMock.getAllUsers).toHaveBeenCalledWith(NaN, NaN);
    });
  });

  describe('GET /users/:id', () => {
    it('should return user by id', async () => {
      userServiceMock.getUserById.mockResolvedValue({ id: '2' });

      const res = await controller.getUserById('2');

      expect(res.id).toBe('2');
      expect(userServiceMock.getUserById).toHaveBeenCalledWith('2');
    });

    it('should propagate error', async () => {
      userServiceMock.getUserById.mockRejectedValue(new Error('fail'));

      await expect(controller.getUserById('2')).rejects.toThrow('fail');
    });
  });

  describe('PATCH /users/:id/ban', () => {
    it('should ban user', async () => {
      userServiceMock.banUser.mockResolvedValue({ id: '3' });

      const res = await controller.banUser('3', mockUser);

      expect(userServiceMock.banUser).toHaveBeenCalledWith('3', 'user-1');
      expect(res.id).toBe('3');
    });

    it('should propagate error', async () => {
      userServiceMock.banUser.mockRejectedValue(new Error('ban fail'));

      await expect(controller.banUser('3', mockUser)).rejects.toThrow(
        'ban fail',
      );
    });
  });

  describe('PATCH /users/:id/unban', () => {
    it('should unban user', async () => {
      userServiceMock.unbanUser.mockResolvedValue({
        id: '3',
        status: 'ACTIVE',
      });

      const res = await controller.unbanUser('3');

      expect(res.status).toBe('ACTIVE');
    });
  });

  describe('PATCH /users/:id/role', () => {
    it('should change role', async () => {
      userServiceMock.changeRole.mockResolvedValue({
        id: '3',
        role: Role.ADMIN,
      });

      const res = await controller.changeRole('3', Role.ADMIN, mockUser);

      expect(userServiceMock.changeRole).toHaveBeenCalledWith(
        '3',
        Role.ADMIN,
        'user-1',
      );

      expect(res.role).toBe(Role.ADMIN);
    });

    it('should propagate service error', async () => {
      userServiceMock.changeRole.mockRejectedValue(new Error('role fail'));

      await expect(
        controller.changeRole('3', Role.ADMIN, mockUser),
      ).rejects.toThrow('role fail');
    });
  });

  describe('DELETE /users/:id', () => {
    it('should delete user (soft delete)', async () => {
      userServiceMock.deleteUser.mockResolvedValue({
        id: '4',
        status: 'DELETED',
      });

      const res = await controller.deleteUser('4', mockUser);

      expect(userServiceMock.deleteUser).toHaveBeenCalledWith('4', 'user-1');

      expect(res.status).toBe('DELETED');
    });

    it('should propagate delete error', async () => {
      userServiceMock.deleteUser.mockRejectedValue(new Error('delete fail'));

      await expect(controller.deleteUser('4', mockUser)).rejects.toThrow(
        'delete fail',
      );
    });
  });
});

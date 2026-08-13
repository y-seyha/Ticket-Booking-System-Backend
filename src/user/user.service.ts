import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccountStatus,
  Account,
  UserProfile,
  UserProfileStatus,
} from '@prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UploadFolder } from '../file-upload/dto/upload-file.dto';
import { FileUploadService } from '../file-upload/file-upload.service';
import { File } from '@prisma/client';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  private transformAccount(account: any) {
    if (!account) return account;
    const { roleId, ...rest } = account;
    return { ...rest, role: roleId };
  }

  private transformAccounts(accounts: any[]) {
    return accounts.map((a) => this.transformAccount(a));
  }

  async getMyProfile(
    accountId: string,
  ): Promise<
    Account & { profile: (UserProfile & { avatar: File | null }) | null }
  > {
    try {
      this.logger.log(`Fetching profile for accountId=${accountId}`);

      const user = await this.prisma.account.findUnique({
        where: { id: accountId },
        include: {
          profile: {
            include: {
              avatar: true,
            },
          },
        },
      });

      if (!user) {
        this.logger.warn(`User not found: ${accountId}`);
        throw new NotFoundException('User not found');
      }

      return this.transformAccount(user);
    } catch (error) {
      this.logger.error(
        `Failed to fetch profile for ${accountId}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  async updateProfile(
    accountId: string,
    dto: UpdateProfileDto,
    file?: Express.Multer.File,
  ): Promise<UserProfile> {
    try {
      this.logger.log(`Updating profile for accountId=${accountId}`);

      let avatarFile: File | null = null;

      if (file) {
        this.logger.log(`Uploading avatar for accountId=${accountId}`);

        avatarFile = await this.fileUploadService.uploadFile(
          file,
          {
            folder: UploadFolder.AVATARS,
            description: 'User Avatar',
          },
          accountId,
        );
      }

      const updated = await this.prisma.userProfile.upsert({
        where: { accountId },
        create: {
          accountId,
          firstName: dto.firstName ?? '',
          lastName: dto.lastName ?? '',
          phone: dto.phone ?? null,
          status: UserProfileStatus.ACTIVE,
          ...(avatarFile && { avatarId: avatarFile.id }),
        },
        update: {
          ...(dto.firstName !== undefined && { firstName: dto.firstName }),
          ...(dto.lastName !== undefined && { lastName: dto.lastName }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(avatarFile && { avatarId: avatarFile.id }),
        },
        include: {
          avatar: true,
        },
      });

      this.logger.log(`Profile saved successfully: ${accountId}`);
      return updated;
    } catch (error) {
      this.logger.error(
        `Failed to update profile for ${accountId}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException('Failed to update profile');
    }
  }

  async disableAccount(accountId: string): Promise<Account> {
    try {
      this.logger.log(`Disabling account: ${accountId}`);

      const account = await this.prisma.account.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      if (account.status === AccountStatus.DELETED) {
        throw new BadRequestException('Account already deleted');
      }

      const updated = await this.prisma.account.update({
        where: { id: accountId },
        data: {
          status: AccountStatus.DELETED,
        },
      });

      this.logger.log(`Account disabled: ${accountId}`);

      return this.transformAccount(updated);
    } catch (error) {
      this.logger.error(
        `Failed to disable account ${accountId}`,
        (error as Error).stack,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to disable account');
    }
  }

  // ADMIN SECTION
  async getAllUsers(page = 1, limit = 20): Promise<Account[]> {
    try {
      this.logger.log(`Fetching users page=${page}, limit=${limit}`);

      const users = await this.prisma.account.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { profile: true },
      });

      const total = await this.prisma.account.count();
      console.log({ total });
      return this.transformAccounts(users);
    } catch (error) {
      this.logger.error('Failed to fetch users', (error as Error).stack);
      throw new InternalServerErrorException('Failed to fetch users');
    }
  }

  async getUserById(id: string): Promise<Account> {
    try {
      this.logger.log(`Fetching user: ${id}`);

      const user = await this.prisma.account.findUnique({
        where: { id },
        include: { profile: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return this.transformAccount(user);
    } catch (error) {
      this.logger.error(`Failed to fetch user ${id}`, (error as Error).stack);

      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException('Failed to fetch user');
    }
  }

  async banUser(targetUserId: string, adminId: string): Promise<Account> {
    try {
      this.logger.log(`Admin ${adminId} banning user ${targetUserId}`);

      if (targetUserId === adminId) {
        throw new BadRequestException('You cannot ban yourself');
      }

      const user = await this.prisma.account.findUnique({
        where: { id: targetUserId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.roleId === 'ADMIN') {
        throw new ForbiddenException('Cannot ban another admin');
      }

      if (user.status === AccountStatus.SUSPENDED) {
        throw new BadRequestException('User already banned');
      }

      const updated = await this.prisma.account.update({
        where: { id: targetUserId },
        data: {
          status: AccountStatus.SUSPENDED,
        },
      });

      return this.transformAccount(updated);
    } catch (error) {
      this.logger.error(
        `Failed to ban user ${targetUserId}`,
        (error as Error).stack,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to ban user');
    }
  }

  async unbanUser(targetUserId: string): Promise<Account> {
    try {
      this.logger.log(`Unbanning user ${targetUserId}`);

      const updated = await this.prisma.account.update({
        where: { id: targetUserId },
        data: {
          status: AccountStatus.ACTIVE,
        },
      });

      return this.transformAccount(updated);
    } catch (error) {
      this.logger.error(
        `Failed to unban user ${targetUserId}`,
        (error as Error).stack,
      );

      throw new InternalServerErrorException('Failed to unban user');
    }
  }

  async changeRole(
    targetUserId: string,
    roleId: string,
    adminId: string,
  ): Promise<Account> {
    try {
      this.logger.log(
        `Admin ${adminId} changing role of ${targetUserId} \u2192 ${roleId}`,
      );

      if (targetUserId === adminId) {
        throw new BadRequestException('You cannot change your own role');
      }

      const user = await this.prisma.account.findUnique({
        where: { id: targetUserId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const role = await this.prisma.role.findUnique({
        where: { id: roleId },
      });

      if (!role) {
        throw new BadRequestException('Role not found');
      }

      const updated = await this.prisma.account.update({
        where: { id: targetUserId },
        data: { roleId },
        include: { role: true },
      });

      return this.transformAccount(updated);
    } catch (error) {
      this.logger.error(
        `Failed to change role for ${targetUserId}`,
        (error as Error).stack,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to change role');
    }
  }

  async deleteUser(targetUserId: string, adminId: string) {
    try {
      this.logger.log(`Admin ${adminId} deleting user ${targetUserId}`);

      if (targetUserId === adminId) {
        throw new BadRequestException('You cannot delete yourself');
      }

      const updated = await this.prisma.account.update({
        where: { id: targetUserId },
        data: {
          status: AccountStatus.DELETED,
        },
      });

      return this.transformAccount(updated);
    } catch (error) {
      this.logger.error(
        `Failed to delete user ${targetUserId}`,
        (error as Error).stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to delete user');
    }
  }
}

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    this.logger.log('Fetching all roles with user counts');
    const roles = await this.prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { accounts: true } },
      },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions as Record<string, boolean> | null,
      userCount: role._count.accounts,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));
  }

  async findOne(id: string) {
    this.logger.log(`Fetching role: ${id}`);
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        _count: { select: { accounts: true } },
      },
    });

    if (!role) throw new NotFoundException('Role not found');

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions as Record<string, boolean> | null,
      userCount: role._count.accounts,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  async create(dto: CreateRoleDto) {
    this.logger.log(`Creating role: ${dto.id}`);

    const existing = await this.prisma.role.findUnique({
      where: { id: dto.id },
    });
    if (existing)
      throw new ConflictException('Role with this ID already exists');

    const role = await this.prisma.role.create({
      data: {
        id: dto.id,
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions ?? {},
      },
    });

    return role;
  }

  async update(id: string, dto: UpdateRoleDto) {
    this.logger.log(`Updating role: ${id}`);

    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    if (dto.id && dto.id !== id) {
      const existing = await this.prisma.role.findUnique({
        where: { id: dto.id },
      });
      if (existing)
        throw new ConflictException('Role with this ID already exists');
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.id !== undefined && { id: dto.id }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.permissions !== undefined && { permissions: dto.permissions }),
      },
    });

    return updated;
  }

  async remove(id: string) {
    this.logger.log(`Deleting role: ${id}`);

    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { accounts: true } } },
    });

    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem)
      throw new BadRequestException('Cannot delete a system role');
    if (role._count.accounts > 0)
      throw new BadRequestException(
        `Cannot delete role with ${role._count.accounts} assigned users`,
      );

    await this.prisma.role.delete({ where: { id } });

    return { message: 'Role deleted successfully' };
  }
}

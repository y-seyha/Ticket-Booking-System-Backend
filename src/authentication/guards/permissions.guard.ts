import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: { id?: string; sub?: string; role?: string } }>();
    const user = request.user;
    if (!user || !user.role) return false;

    const role = await this.prisma.role.findUnique({
      where: { id: user.role },
    });

    if (!role || !role.permissions) return false;

    const permissions = role.permissions as Record<string, boolean>;

    return requiredPermissions.every(perm => permissions[perm] === true);
  }
}
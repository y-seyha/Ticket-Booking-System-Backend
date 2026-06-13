import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    const user = request.user;

    if (!user) return null;

    return {
      id: user.id || user.sub,
      email: user.email,
      role: user.role,
      phone: user.phone,
    };
  },
);

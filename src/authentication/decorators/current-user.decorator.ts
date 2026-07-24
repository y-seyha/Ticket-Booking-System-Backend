import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUserPayload {
  id?: string;
  sub?: string;
  email: string;
  role: string;
  phone?: string | null;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUserPayload }>();

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

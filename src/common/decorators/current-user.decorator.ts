import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { ActiveUser } from '../../modules/acceso/types/jwt-payload.type.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActiveUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

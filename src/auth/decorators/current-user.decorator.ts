import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '../../users/entities/user.entity';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * Inyecta el usuario autenticado que dejó `JwtAuthGuard` en `request.user`.
 *
 * @example
 * findAll(@CurrentUser() user: User) {}
 * findAll(@CurrentUser('id') userId: number) {}
 */
export const CurrentUser = createParamDecorator(
  (field: keyof User | undefined, context: ExecutionContext) => {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return field ? user?.[field] : user;
  },
);

import type { Request } from 'express';
import type { User } from '../../users/entities/user.entity';

/** Petición que ya pasó por `JwtAuthGuard`: `user` es el usuario autenticado (sin `passwordHash`). */
export interface AuthenticatedRequest extends Request {
  user: User;
}

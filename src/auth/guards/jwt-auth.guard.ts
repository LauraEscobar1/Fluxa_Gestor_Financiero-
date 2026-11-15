import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Guard global (registrado como `APP_GUARD` en `AuthModule`). Exige
 * `Authorization: Bearer <token>` en todas las rutas salvo las marcadas con
 * `@Public()`, verifica el JWT y deja el usuario en `request.user`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Falta el token de acceso');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    if (!Number.isInteger(payload.sub)) {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    try {
      request.user = await this.usersService.findById(payload.sub);
    } catch (error) {
      // La cuenta se eliminó después de emitir el token.
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException('El usuario del token ya no existe');
      }
      throw error;
    }
    return true;
  }

  /** Devuelve el token de `Authorization: Bearer <token>` o `undefined`. */
  private extractBearerToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && token ? token : undefined;
  }
}

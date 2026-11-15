import {
  ExecutionContext,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { User } from '../../users/entities/user.entity';
import type { UsersService } from '../../users/users.service';
import { Public } from '../decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

class DemoController {
  @Public()
  open() {}

  closed() {}
}

describe('JwtAuthGuard', () => {
  const secret = 'secreto-de-prueba';
  const jwtService = new JwtService({ secret });
  const user = { id: 1, name: 'Ana', email: 'ana@example.com' } as User;
  const usersService = { findById: jest.fn() };
  const guard = new JwtAuthGuard(
    new Reflector(),
    jwtService,
    usersService as unknown as UsersService,
  );

  /** Contexto HTTP mínimo; devuelve también la request para inspeccionarla. */
  const createContext = (
    authorization?: string,
    handler: () => void = DemoController.prototype.closed,
  ) => {
    const request: { headers: Record<string, string>; user?: User } = {
      headers: authorization ? { authorization } : {},
    };
    const context = {
      getHandler: () => handler,
      getClass: () => DemoController,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  };

  const expectUnauthorized = (promise: Promise<boolean>, message: string) =>
    expect(promise).rejects.toThrow(new UnauthorizedException(message));

  beforeEach(() => {
    jest.clearAllMocks();
    usersService.findById.mockResolvedValue(user);
  });

  it('deja pasar una ruta @Public() sin token', async () => {
    const { context } = createContext(undefined, DemoController.prototype.open);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('lanza 401 sin token', async () => {
    await expectUnauthorized(
      guard.canActivate(createContext().context),
      'Falta el token de acceso',
    );
  });

  it('lanza 401 si el esquema no es Bearer', async () => {
    const token = await jwtService.signAsync({ sub: 1, email: user.email });
    await expectUnauthorized(
      guard.canActivate(createContext(`Basic ${token}`).context),
      'Falta el token de acceso',
    );
  });

  it('lanza 401 con un token inválido', async () => {
    await expectUnauthorized(
      guard.canActivate(createContext('Bearer no-es-un-jwt').context),
      'Token inválido o expirado',
    );
  });

  it('lanza 401 con un token firmado con otro secreto', async () => {
    const token = await new JwtService({ secret: 'otro' }).signAsync({
      sub: 1,
      email: user.email,
    });
    await expectUnauthorized(
      guard.canActivate(createContext(`Bearer ${token}`).context),
      'Token inválido o expirado',
    );
  });

  it('lanza 401 con un token expirado', async () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const token = await jwtService.signAsync({
      sub: 1,
      email: user.email,
      iat: past - 3600,
      exp: past,
    });
    await expectUnauthorized(
      guard.canActivate(createContext(`Bearer ${token}`).context),
      'Token inválido o expirado',
    );
  });

  it('lanza 401 si el usuario del token ya no existe', async () => {
    usersService.findById.mockRejectedValue(new NotFoundException());
    const token = await jwtService.signAsync({ sub: 1, email: user.email });
    await expectUnauthorized(
      guard.canActivate(createContext(`Bearer ${token}`).context),
      'El usuario del token ya no existe',
    );
  });

  it('con un token válido carga el usuario en request.user', async () => {
    const token = await jwtService.signAsync({ sub: 1, email: user.email });
    const { context, request } = createContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(usersService.findById).toHaveBeenCalledWith(1);
    expect(request.user).toBe(user);
  });

  it('no oculta errores inesperados como 401', async () => {
    usersService.findById.mockRejectedValue(new Error('BD caída'));
    const token = await jwtService.signAsync({ sub: 1, email: user.email });
    await expect(
      guard.canActivate(createContext(`Bearer ${token}`).context),
    ).rejects.toThrow('BD caída');
  });
});

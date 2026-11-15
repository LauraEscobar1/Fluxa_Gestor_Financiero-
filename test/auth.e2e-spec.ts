import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';

const JWT_SECRET = 'secreto-e2e';
const user = {
  id: 1,
  name: 'Ana',
  email: 'ana@example.com',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const authService = { register: jest.fn(), login: jest.fn() };
const usersService = {
  findById: jest.fn(),
  update: jest.fn(),
  changePassword: jest.fn(),
  remove: jest.fn(),
};

/**
 * App con los controladores reales de auth y users, servicios simulados, el
 * guard JWT global y la misma configuración de `main.ts` (pipe y filtro).
 * `withThrottler` añade el ThrottlerGuard global, como en `AppModule`.
 */
async function createApp(
  withThrottler = false,
): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      JwtModule.register({ secret: JWT_SECRET }),
      ...(withThrottler
        ? [
            ThrottlerModule.forRoot({
              throttlers: [{ ttl: 60_000, limit: 100 }],
            }),
          ]
        : []),
    ],
    controllers: [AuthController, UsersController],
    providers: [
      { provide: AuthService, useValue: authService },
      { provide: UsersService, useValue: usersService },
      ...(withThrottler
        ? [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
        : []),
      { provide: APP_GUARD, useClass: JwtAuthGuard },
    ],
  }).compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>({
    logger: false,
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();
  return app;
}

describe('Auth y Users (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  beforeAll(async () => {
    app = await createApp();
    token = await new JwtService({ secret: JWT_SECRET }).signAsync({
      sub: user.id,
      email: user.email,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usersService.findById.mockResolvedValue(user);
  });

  describe('POST /auth/register', () => {
    const valid = {
      name: 'Ana',
      email: 'Ana@Example.com',
      password: 'Secreta123',
    };

    it.each([
      ['sin número', 'soloLetras', 'al menos un número'],
      ['sin letra', '12345678', 'al menos una letra'],
      ['demasiado corta', 'abc12', 'al menos 8 caracteres'],
      ['demasiado larga', `a1${'x'.repeat(71)}`, '72 caracteres'],
    ])(
      'contraseña débil (%s) → 400',
      async (_case, password, expectedMessage) => {
        const res = await request(app.getHttpServer())
          .post('/auth/register')
          .send({ ...valid, password })
          .expect(400);

        expect(res.body).toMatchObject({
          statusCode: 400,
          path: '/auth/register',
        });
        expect(res.body.message).toEqual(
          expect.arrayContaining([expect.stringContaining(expectedMessage)]),
        );
        expect(authService.register).not.toHaveBeenCalled();
      },
    );

    it('propiedades extra → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...valid, isAdmin: true })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('isAdmin')]),
      );
      expect(authService.register).not.toHaveBeenCalled();
    });

    it('email inválido → 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...valid, email: 'no-es-un-email' })
        .expect(400);
    });

    it('datos válidos → 201 con token y el email normalizado', async () => {
      authService.register.mockResolvedValue({ accessToken: 'jwt', user });

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(valid)
        .expect(201);

      expect(res.body.accessToken).toBe('jwt');
      expect(authService.register).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ana@example.com' }),
      );
    });
  });

  describe('POST /auth/login', () => {
    it('es pública y propaga 401 de credenciales inválidas', async () => {
      authService.login.mockRejectedValue(
        new UnauthorizedException('Credenciales inválidas'),
      );

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ana@example.com', password: 'Incorrecta1' })
        .expect(401);

      expect(res.body.message).toBe('Credenciales inválidas');
    });
  });

  describe('rutas protegidas', () => {
    it.each([
      ['get', '/users/me'],
      ['patch', '/users/me'],
      ['patch', '/users/me/password'],
      ['delete', '/users/me'],
      ['get', '/auth/me'],
    ] as const)('%s %s sin token → 401', async (method, path) => {
      const res = await request(app.getHttpServer())[method](path).expect(401);

      expect(res.body).toMatchObject({ statusCode: 401, path });
      expect(usersService.findById).not.toHaveBeenCalled();
    });

    it('GET /users/me con token inválido → 401', async () => {
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer token-falso')
        .expect(401);
    });

    it('GET /users/me con token válido → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toMatchObject({ id: 1, email: 'ana@example.com' });
    });

    it('GET /auth/me devuelve el usuario del token', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe(1);
    });

    it('PATCH /users/me/password valida el body', async () => {
      await request(app.getHttpServer())
        .patch('/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'Secreta123', newPassword: 'debil' })
        .expect(400);
      expect(usersService.changePassword).not.toHaveBeenCalled();
    });
  });
});

describe('Límite de peticiones en login (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createApp(true);
  });

  afterAll(async () => {
    await app.close();
  });

  it('permite 5 logins por minuto y responde 429 al sexto', async () => {
    authService.login.mockResolvedValue({ accessToken: 'jwt', user });
    const body = { email: 'ana@example.com', password: 'Secreta123' };

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(body)
        .expect(200);
    }
    await request(app.getHttpServer())
      .post('/auth/login')
      .send(body)
      .expect(429);
  });
});

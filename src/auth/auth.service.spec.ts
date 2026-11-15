import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { hashPassword } from '../common/password';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService, INVALID_CREDENTIALS_MESSAGE } from './auth.service';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

/**
 * AuthService con el UsersService real y el repositorio simulado, para
 * probar el flujo completo (normalización, hash y token) sin base de datos.
 */
describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let storedHash: string;

  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };
  const repository = {
    create: jest.fn((data: Partial<User>) => ({ ...data })),
    save: jest.fn(async (user: Partial<User>) => ({ id: 7, ...user })),
    existsBy: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };

  // `manager` simulado: `getRepository` devuelve el repositorio de usuarios.
  const manager = { getRepository: jest.fn(() => repository) };
  const dataSource = {
    transaction: jest.fn(
      async (work: (m: typeof manager) => Promise<unknown>) => work(manager),
    ),
  };
  const categoriesService = { createDefaultsForUser: jest.fn() };

  const registerDto = {
    name: 'Ana',
    email: 'ana@example.com',
    password: 'Secreta123',
  };

  beforeAll(async () => {
    storedHash = await hashPassword('Secreta123');
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    queryBuilder.where.mockReturnThis();
    queryBuilder.addSelect.mockReturnThis();

    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'secreto-de-prueba',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [
        AuthService,
        UsersService,
        { provide: getRepositoryToken(User), useValue: repository },
        { provide: CategoriesService, useValue: categoriesService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
    jwtService = moduleRef.get(JwtService);
  });

  describe('register', () => {
    it('crea el usuario y devuelve un token con { sub, email }', async () => {
      repository.existsBy.mockResolvedValue(false);

      const result = await service.register(registerDto);

      expect(result.user).toMatchObject({ id: 7, email: 'ana@example.com' });
      expect(result.user).not.toHaveProperty('passwordHash');
      const payload = await jwtService.verifyAsync<JwtPayload>(
        result.accessToken,
      );
      expect(payload).toMatchObject({ sub: 7, email: 'ana@example.com' });
      expect(payload.exp! - payload.iat!).toBe(3600);
    });

    it('crea las categorías por defecto del nuevo usuario en la misma transacción', async () => {
      repository.existsBy.mockResolvedValue(false);

      await service.register(registerDto);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(categoriesService.createDefaultsForUser).toHaveBeenCalledWith(
        7,
        manager,
      );
    });

    it('si fallan las categorías el registro falla y no se emite token', async () => {
      repository.existsBy.mockResolvedValue(false);
      categoriesService.createDefaultsForUser.mockRejectedValueOnce(
        new Error('fallo al insertar'),
      );
      const signSpy = jest.spyOn(jwtService, 'signAsync');

      await expect(service.register(registerDto)).rejects.toThrow(
        'fallo al insertar',
      );
      expect(signSpy).not.toHaveBeenCalled();
    });

    it('lanza 409 si el email ya existe', async () => {
      repository.existsBy.mockResolvedValue(true);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.save).not.toHaveBeenCalled();
      expect(categoriesService.createDefaultsForUser).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const existingUser = () => ({
      id: 7,
      name: 'Ana',
      email: 'ana@example.com',
      passwordHash: storedHash,
    });

    it('devuelve token y usuario sin passwordHash si las credenciales son correctas', async () => {
      queryBuilder.getOne.mockResolvedValue(existingUser());

      const result = await service.login({
        email: 'ana@example.com',
        password: 'Secreta123',
      });

      expect(queryBuilder.addSelect).toHaveBeenCalledWith('user.passwordHash');
      expect(result.user).toEqual({
        id: 7,
        name: 'Ana',
        email: 'ana@example.com',
      });
      const payload = await jwtService.verifyAsync<JwtPayload>(
        result.accessToken,
      );
      expect(payload.sub).toBe(7);
    });

    it('lanza 401 si la contraseña es incorrecta', async () => {
      queryBuilder.getOne.mockResolvedValue(existingUser());

      await expect(
        service.login({ email: 'ana@example.com', password: 'Incorrecta1' }),
      ).rejects.toThrow(new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE));
    });

    it('lanza 401 con el MISMO mensaje si el email no existe', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      const error = await service
        .login({ email: 'nadie@example.com', password: 'Secreta123' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).message).toBe(
        'Credenciales inválidas',
      );
    });
  });
});

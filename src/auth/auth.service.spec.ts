import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
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

    it('lanza 409 si el email ya existe', async () => {
      repository.existsBy.mockResolvedValue(true);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.save).not.toHaveBeenCalled();
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

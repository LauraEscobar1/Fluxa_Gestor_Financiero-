import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { hashPassword, verifyPassword } from '../common/password';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let currentHash: string;

  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };
  const repository = {
    create: jest.fn((data: Partial<User>) => ({ ...data })),
    save: jest.fn(async (user: Partial<User>) => ({ id: 1, ...user })),
    existsBy: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };

  const storedUser = (): User =>
    ({
      id: 1,
      name: 'Ana',
      email: 'ana@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as User;

  beforeAll(async () => {
    currentHash = await hashPassword('Secreta123');
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    queryBuilder.where.mockReturnThis();
    queryBuilder.addSelect.mockReturnThis();

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe('create', () => {
    it('guarda el email en minúsculas, hashea la contraseña y no la devuelve', async () => {
      repository.existsBy.mockResolvedValue(false);

      const user = await service.create({
        name: 'Ana',
        email: '  Ana@Example.COM ',
        password: 'Secreta123',
      });

      expect(repository.existsBy).toHaveBeenCalledWith({
        email: 'ana@example.com',
      });
      const saved = repository.create.mock.calls[0][0];
      expect(saved.email).toBe('ana@example.com');
      expect(saved.passwordHash).not.toBe('Secreta123');
      expect(await verifyPassword('Secreta123', saved.passwordHash!)).toBe(
        true,
      );
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).toMatchObject({ id: 1, email: 'ana@example.com' });
    });

    it('lanza 409 si el email ya existe', async () => {
      repository.existsBy.mockResolvedValue(true);

      await expect(
        service.create({
          name: 'Ana',
          email: 'ana@example.com',
          password: 'Secreta123',
        }),
      ).rejects.toThrow(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findByEmail', () => {
    it('solo agrega passwordHash cuando se pide', async () => {
      await service.findByEmail('ANA@example.com');
      expect(queryBuilder.where).toHaveBeenCalledWith('user.email = :email', {
        email: 'ana@example.com',
      });
      expect(queryBuilder.addSelect).not.toHaveBeenCalled();

      await service.findByEmail('ana@example.com', { withPassword: true });
      expect(queryBuilder.addSelect).toHaveBeenCalledWith('user.passwordHash');
    });
  });

  describe('findById', () => {
    it('lanza 404 si no existe', async () => {
      repository.findOneBy.mockResolvedValue(null);
      await expect(service.findById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('lanza 409 si el nuevo email pertenece a otro usuario', async () => {
      repository.findOneBy.mockResolvedValue(storedUser());
      repository.existsBy.mockResolvedValue(true);

      await expect(
        service.update(1, { email: 'Otro@Example.com' }),
      ).rejects.toThrow(ConflictException);
      expect(repository.existsBy).toHaveBeenCalledWith({
        email: 'otro@example.com',
      });
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('no comprueba duplicados si el email no cambia', async () => {
      repository.findOneBy.mockResolvedValue(storedUser());

      const user = await service.update(1, {
        name: 'Ana María',
        email: 'ANA@example.com',
      });

      expect(repository.existsBy).not.toHaveBeenCalled();
      expect(user).toMatchObject({
        name: 'Ana María',
        email: 'ana@example.com',
      });
    });
  });

  describe('changePassword', () => {
    it('lanza 400 si la contraseña actual no coincide', async () => {
      queryBuilder.getOne.mockResolvedValue({
        ...storedUser(),
        passwordHash: currentHash,
      });

      await expect(
        service.changePassword(1, {
          currentPassword: 'Incorrecta1',
          newPassword: 'NuevaClave456',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('guarda el hash de la nueva contraseña si la actual coincide', async () => {
      queryBuilder.getOne.mockResolvedValue({
        ...storedUser(),
        passwordHash: currentHash,
      });

      const result = await service.changePassword(1, {
        currentPassword: 'Secreta123',
        newPassword: 'NuevaClave456',
      });

      expect(result).toEqual({
        message: 'Contraseña actualizada correctamente',
      });
      const [id, { passwordHash }] = repository.update.mock.calls[0];
      expect(id).toBe(1);
      expect(await verifyPassword('NuevaClave456', passwordHash)).toBe(true);
    });

    it('lanza 404 si el usuario no existe', async () => {
      queryBuilder.getOne.mockResolvedValue(null);
      await expect(
        service.changePassword(1, {
          currentPassword: 'Secreta123',
          newPassword: 'NuevaClave456',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('devuelve { message } al eliminar', async () => {
      repository.delete.mockResolvedValue({ affected: 1 });
      await expect(service.remove(1)).resolves.toEqual({
        message: 'Cuenta eliminada correctamente',
      });
    });

    it('lanza 404 si no existe', async () => {
      repository.delete.mockResolvedValue({ affected: 0 });
      await expect(service.remove(1)).rejects.toThrow(NotFoundException);
    });
  });
});

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { CategoriesService } from './categories.service';
import { DEFAULT_CATEGORIES } from './default-categories';
import { Category } from './entities/category.entity';
import { CategoryType } from './enums/category-type.enum';

describe('CategoriesService', () => {
  let service: CategoriesService;

  const insertBuilder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  };
  const repository = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    existsBy: jest.fn(),
    create: jest.fn((data: Partial<Category>) => ({ ...data })),
    save: jest.fn(async (c: Partial<Category>) => ({ id: 10, ...c })),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => insertBuilder),
  };

  const USER_ID = 1;
  const existing = (): Category =>
    ({
      id: 5,
      name: 'Mascotas',
      type: CategoryType.EXPENSE,
      userId: USER_ID,
    }) as Category;

  beforeEach(async () => {
    jest.clearAllMocks();
    for (const fn of Object.values(insertBuilder)) {
      if (fn !== insertBuilder.execute) fn.mockReturnThis();
    }
    const moduleRef = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: getRepositoryToken(Category), useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(CategoriesService);
  });

  describe('findAll', () => {
    it('filtra por usuario, ordena por nombre y aplica el tipo si se envía', async () => {
      repository.find.mockResolvedValue([]);

      await service.findAll(USER_ID, CategoryType.INCOME);
      await service.findAll(USER_ID);

      expect(repository.find).toHaveBeenNthCalledWith(1, {
        where: { userId: USER_ID, type: CategoryType.INCOME },
        order: { name: 'ASC' },
      });
      expect(repository.find).toHaveBeenNthCalledWith(2, {
        where: { userId: USER_ID },
        order: { name: 'ASC' },
      });
    });
  });

  describe('create', () => {
    it('guarda la categoría asociada al usuario', async () => {
      repository.existsBy.mockResolvedValue(false);

      const result = await service.create(USER_ID, {
        name: 'Mascotas',
        type: CategoryType.EXPENSE,
      });

      expect(repository.existsBy).toHaveBeenCalledWith({
        userId: USER_ID,
        type: CategoryType.EXPENSE,
        name: 'Mascotas',
      });
      expect(result).toMatchObject({
        id: 10,
        userId: USER_ID,
        name: 'Mascotas',
        type: CategoryType.EXPENSE,
      });
    });

    it('lanza 409 si ya existe esa combinación para el usuario', async () => {
      repository.existsBy.mockResolvedValue(true);

      await expect(
        service.create(USER_ID, {
          name: 'Mascotas',
          type: CategoryType.EXPENSE,
        }),
      ).rejects.toThrow(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('lanza 404 si no existe o es de otro usuario (se filtra por userId)', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(2, 5)).rejects.toThrow(NotFoundException);
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 5, userId: 2 });
    });

    it('devuelve la categoría del usuario', async () => {
      repository.findOneBy.mockResolvedValue(existing());

      await expect(service.findOne(USER_ID, 5)).resolves.toMatchObject({
        id: 5,
      });
    });
  });

  describe('update', () => {
    it('lanza 409 si el nuevo nombre ya existe para ese tipo', async () => {
      repository.findOneBy.mockResolvedValue(existing());
      repository.existsBy.mockResolvedValue(true);

      await expect(
        service.update(USER_ID, 5, { name: 'Transporte' }),
      ).rejects.toThrow(ConflictException);
      expect(repository.existsBy).toHaveBeenCalledWith({
        userId: USER_ID,
        type: CategoryType.EXPENSE,
        name: 'Transporte',
      });
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('no comprueba duplicados si el nombre no cambia', async () => {
      repository.findOneBy.mockResolvedValue(existing());

      await service.update(USER_ID, 5, { name: 'Mascotas' });

      expect(repository.existsBy).not.toHaveBeenCalled();
    });

    it('guarda el nuevo nombre sin tocar el tipo', async () => {
      repository.findOneBy.mockResolvedValue(existing());
      repository.existsBy.mockResolvedValue(false);

      const result = await service.update(USER_ID, 5, { name: 'Perros' });

      expect(result).toMatchObject({
        name: 'Perros',
        type: CategoryType.EXPENSE,
      });
    });

    it('lanza 404 si la categoría es de otro usuario', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.update(2, 5, { name: 'Perros' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('devuelve { message } al eliminar', async () => {
      repository.delete.mockResolvedValue({ affected: 1 });

      await expect(service.remove(USER_ID, 5)).resolves.toEqual({
        message: 'Categoría eliminada correctamente',
      });
      expect(repository.delete).toHaveBeenCalledWith({
        id: 5,
        userId: USER_ID,
      });
    });

    it('lanza 404 si no existe o es de otro usuario', async () => {
      repository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove(2, 5)).rejects.toThrow(NotFoundException);
    });

    it('lanza 409 con mensaje claro si tiene transacciones (FK 23503)', async () => {
      repository.delete.mockRejectedValue(
        new QueryFailedError('DELETE', [], {
          code: '23503',
        } as unknown as Error),
      );

      await expect(service.remove(USER_ID, 5)).rejects.toThrow(
        new ConflictException('La categoría tiene transacciones asociadas'),
      );
    });

    it('relanza errores inesperados', async () => {
      repository.delete.mockRejectedValue(new Error('boom'));

      await expect(service.remove(USER_ID, 5)).rejects.toThrow('boom');
    });
  });

  describe('createDefaultsForUser', () => {
    it('inserta todas las categorías en lote ignorando duplicados', async () => {
      await service.createDefaultsForUser(USER_ID);

      expect(insertBuilder.into).toHaveBeenCalledWith(Category);
      const values = insertBuilder.values.mock.calls[0][0] as Category[];
      expect(values).toHaveLength(DEFAULT_CATEGORIES.length);
      expect(values.every((v) => v.userId === USER_ID)).toBe(true);
      expect(
        values.filter((v) => v.type === CategoryType.EXPENSE),
      ).toHaveLength(9);
      expect(values.filter((v) => v.type === CategoryType.INCOME)).toHaveLength(
        4,
      );
      expect(insertBuilder.orIgnore).toHaveBeenCalledTimes(1);
      expect(insertBuilder.execute).toHaveBeenCalledTimes(1);
    });

    it('es idempotente: llamarlo dos veces no falla', async () => {
      await service.createDefaultsForUser(USER_ID);
      await expect(
        service.createDefaultsForUser(USER_ID),
      ).resolves.toBeUndefined();
      expect(insertBuilder.orIgnore).toHaveBeenCalledTimes(2);
    });

    it('usa el repositorio del EntityManager recibido (transacción)', async () => {
      const txBuilder = { ...insertBuilder };
      const manager = {
        getRepository: jest.fn(() => ({
          createQueryBuilder: jest.fn(() => txBuilder),
        })),
      };

      await service.createDefaultsForUser(
        USER_ID,
        manager as unknown as import('typeorm').EntityManager,
      );

      expect(manager.getRepository).toHaveBeenCalledWith(Category);
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});

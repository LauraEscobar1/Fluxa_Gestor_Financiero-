import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CategoriesService } from '../categories/categories.service';
import { Category } from '../categories/entities/category.entity';
import { CategoryType } from '../categories/enums/category-type.enum';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { Transaction } from './entities/transaction.entity';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;

  const USER_ID = 1;
  const OTHER_USER_ID = 2;
  // "Hoy" fijo para que el límite de un año sea determinista: 2026-06-15.
  const NOW = new Date('2026-06-15T12:00:00Z');

  const qb = {
    innerJoin: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getOne: jest.fn(),
  };
  const repository = {
    createQueryBuilder: jest.fn(() => qb),
    findOneBy: jest.fn(),
    create: jest.fn((data: Partial<Transaction>) => ({ ...data })),
    merge: jest.fn((target: Transaction, source: Partial<Transaction>) =>
      Object.assign(target, source),
    ),
    save: jest.fn(async (t: Partial<Transaction>) => ({ id: 20, ...t })),
    delete: jest.fn(),
  };
  const categoriesService = { findOne: jest.fn() };

  const category = (type: CategoryType, id = 3): Category =>
    ({ id, name: 'Alimentación', type, userId: USER_ID }) as Category;

  const stored = (): Transaction =>
    ({
      id: 20,
      amount: 50,
      type: CategoryType.EXPENSE,
      description: null,
      date: '2026-06-01',
      categoryId: 3,
      userId: USER_ID,
    }) as Transaction;

  const validCreate = {
    amount: 50.25,
    type: CategoryType.EXPENSE,
    categoryId: 3,
    date: '2026-06-01',
    description: 'Mercado',
  };

  const listQuery = (
    values: Partial<ListTransactionsQueryDto> = {},
  ): ListTransactionsQueryDto =>
    Object.assign(new ListTransactionsQueryDto(), values);

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
    for (const [name, fn] of Object.entries(qb)) {
      if (name !== 'getManyAndCount' && name !== 'getOne') fn.mockReturnThis();
    }
    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: getRepositoryToken(Transaction), useValue: repository },
        { provide: CategoriesService, useValue: categoriesService },
      ],
    }).compile();
    service = moduleRef.get(TransactionsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('create', () => {
    it('guarda la transacción del usuario y la devuelve con su categoría', async () => {
      categoriesService.findOne.mockResolvedValue(
        category(CategoryType.EXPENSE),
      );
      const withCategory = {
        ...stored(),
        category: { id: 3, name: 'Alimentación', type: CategoryType.EXPENSE },
      };
      qb.getOne.mockResolvedValue(withCategory);

      const result = await service.create(USER_ID, validCreate);

      expect(categoriesService.findOne).toHaveBeenCalledWith(USER_ID, 3);
      expect(repository.save).toHaveBeenCalledWith({
        userId: USER_ID,
        amount: 50.25,
        type: CategoryType.EXPENSE,
        categoryId: 3,
        date: '2026-06-01',
        description: 'Mercado',
      });
      // Se relee filtrando por usuario e id para devolver la categoría.
      expect(qb.where).toHaveBeenCalledWith('transaction.userId = :userId', {
        userId: USER_ID,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('transaction.id = :id', {
        id: 20,
      });
      expect(result).toBe(withCategory);
    });

    it('guarda description null si no se envía', async () => {
      categoriesService.findOne.mockResolvedValue(
        category(CategoryType.EXPENSE),
      );
      qb.getOne.mockResolvedValue(stored());
      const { description: _d, ...withoutDescription } = validCreate;

      await service.create(USER_ID, withoutDescription);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ description: null }),
      );
    });

    it('categoría de otro usuario → 404 y no guarda', async () => {
      categoriesService.findOne.mockRejectedValue(
        new NotFoundException('Categoría no encontrada'),
      );

      await expect(service.create(USER_ID, validCreate)).rejects.toThrow(
        new NotFoundException('Categoría no encontrada'),
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('tipo distinto al de la categoría → 400 y no guarda', async () => {
      categoriesService.findOne.mockResolvedValue(
        category(CategoryType.INCOME),
      );

      await expect(service.create(USER_ID, validCreate)).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('fecha a más de un año en el futuro → 400', async () => {
      await expect(
        service.create(USER_ID, { ...validCreate, date: '2027-06-16' }),
      ).rejects.toThrow(
        new BadRequestException(
          'La fecha no puede ser posterior a 2027-06-15 (un año desde hoy)',
        ),
      );
      expect(categoriesService.findOne).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('acepta exactamente un año en el futuro', async () => {
      categoriesService.findOne.mockResolvedValue(
        category(CategoryType.EXPENSE),
      );
      qb.getOne.mockResolvedValue(stored());

      await expect(
        service.create(USER_ID, { ...validCreate, date: '2027-06-15' }),
      ).resolves.toBeDefined();
    });
  });

  describe('findAll', () => {
    it('sin filtros: solo filtra por usuario, ordena y pagina', async () => {
      qb.getManyAndCount.mockResolvedValue([[stored()], 1]);

      const result = await service.findAll(USER_ID, listQuery());

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('transaction');
      expect(qb.innerJoin).toHaveBeenCalledWith(
        'transaction.category',
        'category',
      );
      expect(qb.addSelect).toHaveBeenCalledWith([
        'category.id',
        'category.name',
        'category.type',
      ]);
      expect(qb.where).toHaveBeenCalledWith('transaction.userId = :userId', {
        userId: USER_ID,
      });
      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(qb.orderBy).toHaveBeenCalledWith('transaction.date', 'DESC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('transaction.id', 'DESC');
      expect(qb.offset).toHaveBeenCalledWith(0);
      expect(qb.limit).toHaveBeenCalledWith(20);
      expect(result).toEqual({
        data: [stored()],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('aplica tipo, categoría, rango de fechas y la página pedida', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 42]);

      const result = await service.findAll(
        USER_ID,
        listQuery({
          type: CategoryType.EXPENSE,
          categoryId: 3,
          from: '2026-01-01',
          to: '2026-01-31',
          page: 3,
          limit: 10,
        }),
      );

      expect(qb.andWhere.mock.calls).toEqual([
        ['transaction.type = :type', { type: CategoryType.EXPENSE }],
        ['transaction.categoryId = :categoryId', { categoryId: 3 }],
        ['transaction.date >= :from', { from: '2026-01-01' }],
        ['transaction.date <= :to', { to: '2026-01-31' }],
      ]);
      expect(qb.offset).toHaveBeenCalledWith(20);
      expect(qb.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual({ data: [], total: 42, page: 3, limit: 10 });
    });
  });

  describe('findOne', () => {
    it('de otro usuario → 404 (se filtra por userId)', async () => {
      qb.getOne.mockResolvedValue(null);

      await expect(service.findOne(OTHER_USER_ID, 20)).rejects.toThrow(
        new NotFoundException('Transacción no encontrada'),
      );
      expect(qb.where).toHaveBeenCalledWith('transaction.userId = :userId', {
        userId: OTHER_USER_ID,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('transaction.id = :id', {
        id: 20,
      });
    });
  });

  describe('update', () => {
    it('de otro usuario → 404', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(
        service.update(OTHER_USER_ID, 20, { amount: 10 }),
      ).rejects.toThrow(NotFoundException);
      expect(repository.findOneBy).toHaveBeenCalledWith({
        id: 20,
        userId: OTHER_USER_ID,
      });
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('si solo cambia el monto no revalida la categoría', async () => {
      repository.findOneBy.mockResolvedValue(stored());
      qb.getOne.mockResolvedValue(stored());

      await service.update(USER_ID, 20, { amount: 99.9 });

      expect(categoriesService.findOne).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 99.9, categoryId: 3 }),
      );
    });

    it('cambiar solo el tipo revalida contra la categoría actual → 400', async () => {
      repository.findOneBy.mockResolvedValue(stored());
      categoriesService.findOne.mockResolvedValue(
        category(CategoryType.EXPENSE),
      );

      await expect(
        service.update(USER_ID, 20, { type: CategoryType.INCOME }),
      ).rejects.toThrow(BadRequestException);
      expect(categoriesService.findOne).toHaveBeenCalledWith(USER_ID, 3);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('cambiar solo la categoría revalida contra el tipo actual → 400', async () => {
      repository.findOneBy.mockResolvedValue(stored());
      categoriesService.findOne.mockResolvedValue(
        category(CategoryType.INCOME, 7),
      );

      await expect(
        service.update(USER_ID, 20, { categoryId: 7 }),
      ).rejects.toThrow(BadRequestException);
      expect(categoriesService.findOne).toHaveBeenCalledWith(USER_ID, 7);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('cambiar tipo y categoría coherentes guarda los nuevos valores', async () => {
      repository.findOneBy.mockResolvedValue(stored());
      categoriesService.findOne.mockResolvedValue(
        category(CategoryType.INCOME, 7),
      );
      qb.getOne.mockResolvedValue(stored());

      await service.update(USER_ID, 20, {
        type: CategoryType.INCOME,
        categoryId: 7,
      });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: CategoryType.INCOME, categoryId: 7 }),
      );
    });

    it('categoría nueva de otro usuario → 404', async () => {
      repository.findOneBy.mockResolvedValue(stored());
      categoriesService.findOne.mockRejectedValue(
        new NotFoundException('Categoría no encontrada'),
      );

      await expect(
        service.update(USER_ID, 20, { categoryId: 99 }),
      ).rejects.toThrow(NotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('fecha a más de un año en el futuro → 400', async () => {
      repository.findOneBy.mockResolvedValue(stored());

      await expect(
        service.update(USER_ID, 20, { date: '2030-01-01' }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('description null borra la descripción', async () => {
      repository.findOneBy.mockResolvedValue({
        ...stored(),
        description: 'Antes',
      });
      qb.getOne.mockResolvedValue(stored());

      await service.update(USER_ID, 20, { description: null });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ description: null }),
      );
    });
  });

  describe('remove', () => {
    it('devuelve { message } al eliminar', async () => {
      repository.delete.mockResolvedValue({ affected: 1 });

      await expect(service.remove(USER_ID, 20)).resolves.toEqual({
        message: 'Transacción eliminada correctamente',
      });
      expect(repository.delete).toHaveBeenCalledWith({
        id: 20,
        userId: USER_ID,
      });
    });

    it('de otro usuario → 404', async () => {
      repository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove(OTHER_USER_ID, 20)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

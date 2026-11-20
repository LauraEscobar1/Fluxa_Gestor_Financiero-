import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CategoriesService } from '../categories/categories.service';
import { CategoryType } from '../categories/enums/category-type.enum';
import { Transaction } from '../transactions/entities/transaction.entity';
import { BudgetsService } from './budgets.service';
import { Budget } from './entities/budget.entity';
import { BudgetStatus } from './enums/budget-status.enum';

describe('BudgetsService', () => {
  let service: BudgetsService;

  const USER_ID = 1;
  const budgetQb = {
    innerJoin: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getOne: jest.fn(),
  };
  const spentQb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  const budgetsRepository = {
    createQueryBuilder: jest.fn(() => budgetQb),
    findOneBy: jest.fn(),
    existsBy: jest.fn(),
    create: jest.fn((data: Partial<Budget>) => ({ ...data })),
    save: jest.fn(async (b: Partial<Budget>) => ({ id: 10, ...b })),
    delete: jest.fn(),
  };
  const transactionsRepository = {
    createQueryBuilder: jest.fn(() => spentQb),
  };
  const categoriesService = { findOne: jest.fn() };

  const budget = (over: Partial<Budget> = {}): Budget =>
    ({
      id: 10,
      categoryId: 3,
      category: { id: 3, name: 'Alimentación' },
      amount: 1000,
      month: 1,
      year: 2026,
      userId: USER_ID,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      ...over,
    }) as Budget;

  /** Simula que la consulta agregada devuelve `spent` para la categoría 3. */
  const spend = (spent: string | null) =>
    spentQb.getRawMany.mockResolvedValue(
      spent === null ? [] : [{ categoryId: 3, spent }],
    );

  beforeEach(async () => {
    jest.clearAllMocks();
    for (const qb of [budgetQb, spentQb]) {
      for (const [name, fn] of Object.entries(qb)) {
        if (!name.startsWith('get')) fn.mockReturnThis();
      }
    }
    categoriesService.findOne.mockResolvedValue({
      id: 3,
      name: 'Alimentación',
      type: CategoryType.EXPENSE,
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        BudgetsService,
        { provide: getRepositoryToken(Budget), useValue: budgetsRepository },
        {
          provide: getRepositoryToken(Transaction),
          useValue: transactionsRepository,
        },
        { provide: CategoriesService, useValue: categoriesService },
      ],
    }).compile();
    service = moduleRef.get(BudgetsService);
  });

  describe('create', () => {
    const dto = { categoryId: 3, amount: 1000, month: 1, year: 2026 };

    it('crea el presupuesto del usuario y lo devuelve con campos calculados', async () => {
      budgetsRepository.existsBy.mockResolvedValue(false);
      budgetQb.getOne.mockResolvedValue(budget());
      spend(null);

      const result = await service.create(USER_ID, dto);

      expect(categoriesService.findOne).toHaveBeenCalledWith(USER_ID, 3);
      expect(budgetsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, ...dto }),
      );
      expect(result).toMatchObject({
        id: 10,
        spent: 0,
        remaining: 1000,
        percentUsed: 0,
        status: BudgetStatus.OK,
        category: { id: 3, name: 'Alimentación' },
      });
    });

    it('categoría de tipo income → 400', async () => {
      categoriesService.findOne.mockResolvedValue({
        id: 3,
        name: 'Salario',
        type: CategoryType.INCOME,
      });

      await expect(service.create(USER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(budgetsRepository.save).not.toHaveBeenCalled();
    });

    it('categoría ajena o inexistente → 404', async () => {
      categoriesService.findOne.mockRejectedValue(
        new NotFoundException('Categoría no encontrada'),
      );

      await expect(service.create(USER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(budgetsRepository.save).not.toHaveBeenCalled();
    });

    it('presupuesto duplicado para categoría y mes → 409', async () => {
      budgetsRepository.existsBy.mockResolvedValue(true);

      await expect(service.create(USER_ID, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(budgetsRepository.existsBy).toHaveBeenCalledWith({
        userId: USER_ID,
        categoryId: 3,
        month: 1,
        year: 2026,
      });
      expect(budgetsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('cálculo de campos (findOne)', () => {
    it.each([
      ['ok', '500.00', BudgetStatus.OK, 50, 500],
      ['warning justo en 80 %', '800.00', BudgetStatus.WARNING, 80, 200],
      ['warning por debajo del 100 %', '1000.00', BudgetStatus.WARNING, 100, 0],
      ['exceeded', '1250.50', BudgetStatus.EXCEEDED, 125.05, -250.5],
    ])('%s', async (_label, spent, status, percentUsed, remaining) => {
      budgetQb.getOne.mockResolvedValue(budget());
      spend(spent);

      const result = await service.findOne(USER_ID, 10);

      expect(result).toMatchObject({
        spent: Number(spent),
        status,
        percentUsed,
        remaining,
      });
    });

    it('79.99 % sigue en ok', async () => {
      budgetQb.getOne.mockResolvedValue(budget());
      spend('799.90');

      const result = await service.findOne(USER_ID, 10);

      expect(result.percentUsed).toBe(79.99);
      expect(result.status).toBe(BudgetStatus.OK);
    });

    it('spent = 0 si no hay transacciones y amount muy chico', async () => {
      budgetQb.getOne.mockResolvedValue(budget({ amount: 0.01 }));
      spend(null);

      const result = await service.findOne(USER_ID, 10);

      expect(result).toMatchObject({
        spent: 0,
        remaining: 0.01,
        percentUsed: 0,
        status: BudgetStatus.OK,
      });
    });

    it('amount muy chico con gasto: porcentaje alto sin errores', async () => {
      budgetQb.getOne.mockResolvedValue(budget({ amount: 0.01 }));
      spend('5.00');

      const result = await service.findOne(USER_ID, 10);

      expect(result.percentUsed).toBe(50000);
      expect(result.status).toBe(BudgetStatus.EXCEEDED);
    });

    it('lanza 404 si no existe o es de otro usuario (se filtra por userId)', async () => {
      budgetQb.getOne.mockResolvedValue(null);

      await expect(service.findOne(2, 10)).rejects.toThrow(NotFoundException);
      expect(budgetQb.where).toHaveBeenCalledWith('budget.userId = :userId', {
        userId: 2,
      });
    });
  });

  describe('getStatusForMonth / findAll', () => {
    it('calcula lo gastado con UNA sola consulta agregada para todos los presupuestos', async () => {
      budgetQb.getMany.mockResolvedValue([
        budget({ id: 1, categoryId: 3, amount: 1000 }),
        budget({
          id: 2,
          categoryId: 4,
          category: { id: 4, name: 'Transporte' },
          amount: 200,
        }),
        budget({
          id: 3,
          categoryId: 5,
          category: { id: 5, name: 'Salud' },
          amount: 100,
        }),
      ]);
      spentQb.getRawMany.mockResolvedValue([
        { categoryId: 3, spent: '900.00' },
        { categoryId: 4, spent: '250.00' },
      ]);

      const result = await service.getStatusForMonth(USER_ID, 1, 2026);

      expect(transactionsRepository.createQueryBuilder).toHaveBeenCalledTimes(
        1,
      );
      expect(spentQb.getRawMany).toHaveBeenCalledTimes(1);
      expect(spentQb.groupBy).toHaveBeenCalledWith('transaction.categoryId');
      expect(result.map((r) => [r.id, r.spent, r.status])).toEqual([
        [1, 900, BudgetStatus.WARNING],
        [2, 250, BudgetStatus.EXCEEDED],
        [3, 0, BudgetStatus.OK],
      ]);
    });

    it('limita las transacciones al usuario, a gastos y al mes pedido', async () => {
      budgetQb.getMany.mockResolvedValue([budget()]);
      spend(null);

      await service.getStatusForMonth(USER_ID, 12, 2026);

      expect(spentQb.where).toHaveBeenCalledWith(
        'transaction.userId = :userId',
        { userId: USER_ID },
      );
      expect(spentQb.andWhere).toHaveBeenCalledWith(
        'transaction.type = :type',
        {
          type: CategoryType.EXPENSE,
        },
      );
      expect(spentQb.andWhere).toHaveBeenCalledWith(
        'transaction.date >= :start',
        { start: '2026-12-01' },
      );
      expect(spentQb.andWhere).toHaveBeenCalledWith('transaction.date < :end', {
        end: '2027-01-01',
      });
    });

    it('ordena por nombre de categoría', async () => {
      budgetQb.getMany.mockResolvedValue([]);

      await service.getStatusForMonth(USER_ID, 1, 2026);

      expect(budgetQb.orderBy).toHaveBeenCalledWith('category.name', 'ASC');
    });

    it('sin presupuestos no consulta transacciones', async () => {
      budgetQb.getMany.mockResolvedValue([]);

      await expect(
        service.getStatusForMonth(USER_ID, 1, 2026),
      ).resolves.toEqual([]);
      expect(transactionsRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('findAll usa el mes de Colombia en el borde de fin de mes (8 p. m. del 30 de noviembre)', async () => {
      // 2026-12-01T01:00Z ya es diciembre en UTC, pero en Bogotá son las 8 p. m. del 30 de noviembre.
      jest.useFakeTimers({ now: new Date('2026-12-01T01:00:00Z') });
      try {
        budgetQb.getMany.mockResolvedValue([]);

        await service.findAll(USER_ID, {});

        expect(budgetQb.andWhere).toHaveBeenCalledWith(
          'budget.month = :month',
          { month: 11 },
        );
        expect(budgetQb.andWhere).toHaveBeenCalledWith('budget.year = :year', {
          year: 2026,
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it('findAll usa el mes y año actuales por defecto', async () => {
      jest.useFakeTimers({ now: new Date('2026-03-15T12:00:00Z') });
      try {
        budgetQb.getMany.mockResolvedValue([]);

        await service.findAll(USER_ID, {});

        expect(budgetQb.andWhere).toHaveBeenCalledWith(
          'budget.month = :month',
          { month: 3 },
        );
        expect(budgetQb.andWhere).toHaveBeenCalledWith('budget.year = :year', {
          year: 2026,
        });
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('update', () => {
    it('cambia solo el monto', async () => {
      const existing = budget();
      budgetsRepository.findOneBy.mockResolvedValue(existing);
      budgetQb.getOne.mockResolvedValue(budget({ amount: 2000 }));
      spend(null);

      const result = await service.update(USER_ID, 10, { amount: 2000 });

      expect(budgetsRepository.findOneBy).toHaveBeenCalledWith({
        id: 10,
        userId: USER_ID,
      });
      expect(budgetsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2000,
          categoryId: 3,
          month: 1,
          year: 2026,
        }),
      );
      expect(result.amount).toBe(2000);
    });

    it('lanza 404 si es de otro usuario', async () => {
      budgetsRepository.findOneBy.mockResolvedValue(null);

      await expect(service.update(2, 10, { amount: 5 })).rejects.toThrow(
        NotFoundException,
      );
      expect(budgetsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('devuelve { message } al eliminar', async () => {
      budgetsRepository.delete.mockResolvedValue({ affected: 1 });

      await expect(service.remove(USER_ID, 10)).resolves.toEqual({
        message: 'Presupuesto eliminado correctamente',
      });
      expect(budgetsRepository.delete).toHaveBeenCalledWith({
        id: 10,
        userId: USER_ID,
      });
    });

    it('lanza 404 si no existe o es de otro usuario', async () => {
      budgetsRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove(2, 10)).rejects.toThrow(NotFoundException);
    });
  });
});

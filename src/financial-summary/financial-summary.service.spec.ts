import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BudgetsService } from '../budgets/budgets.service';
import { BudgetStatus } from '../budgets/enums/budget-status.enum';
import { CategoryType } from '../categories/enums/category-type.enum';
import { SavingsGoalsService } from '../savings-goals/savings-goals.service';
import { Transaction } from '../transactions/entities/transaction.entity';
import {
  distributePercentages,
  FinancialSummaryService,
} from './financial-summary.service';

describe('FinancialSummaryService', () => {
  let service: FinancialSummaryService;

  const USER_ID = 7;
  const qb = {
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  const transactionsRepository = { createQueryBuilder: jest.fn(() => qb) };
  const budgetsService = { getStatusForMonth: jest.fn() };
  const savingsGoalsService = { getProgressSummary: jest.fn() };
  const noGoals = { totalSaved: 0, totalTarget: 0, active: 0, completed: 0 };

  /** Comprueba que la consulta filtra por el usuario y por el rango de fechas. */
  const expectScopedQuery = (start: string, end: string) => {
    expect(qb.where).toHaveBeenCalledWith('transaction.userId = :userId', {
      userId: USER_ID,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('transaction.date >= :start', {
      start,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('transaction.date < :end', {
      end,
    });
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    for (const [name, fn] of Object.entries(qb)) {
      if (!name.startsWith('get')) fn.mockReturnThis();
    }
    qb.getRawMany.mockResolvedValue([]);
    budgetsService.getStatusForMonth.mockResolvedValue([]);
    savingsGoalsService.getProgressSummary.mockResolvedValue(noGoals);

    const moduleRef = await Test.createTestingModule({
      providers: [
        FinancialSummaryService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: transactionsRepository,
        },
        { provide: BudgetsService, useValue: budgetsService },
        { provide: SavingsGoalsService, useValue: savingsGoalsService },
      ],
    }).compile();
    service = moduleRef.get(FinancialSummaryService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getSummary', () => {
    it('suma ingresos y gastos en SQL (strings de Postgres) y calcula balance y tasa de ahorro', async () => {
      qb.getRawMany.mockResolvedValue([
        { type: CategoryType.INCOME, total: '4100000.00' },
        { type: CategoryType.EXPENSE, total: '2225000.10' },
      ]);

      const result = await service.getSummary(USER_ID, {
        month: 3,
        year: 2026,
      });

      expect(result).toMatchObject({
        month: 3,
        year: 2026,
        income: 4100000,
        expenses: 2225000.1,
        balance: 1874999.9,
        savingsRate: 45.73,
      });
      expect(qb.select).toHaveBeenCalledWith('transaction.type', 'type');
      expect(qb.addSelect).toHaveBeenCalledWith(
        'SUM(transaction.amount)',
        'total',
      );
      expect(qb.groupBy).toHaveBeenCalledWith('transaction.type');
      expectScopedQuery('2026-03-01', '2026-04-01');
    });

    it('sin ingresos: savingsRate 0 (sin división por cero) y balance negativo', async () => {
      qb.getRawMany.mockResolvedValue([
        { type: CategoryType.EXPENSE, total: '150.50' },
      ]);

      const result = await service.getSummary(USER_ID, {
        month: 1,
        year: 2026,
      });

      expect(result).toMatchObject({
        income: 0,
        expenses: 150.5,
        balance: -150.5,
        savingsRate: 0,
      });
    });

    it('gastos mayores que los ingresos: savingsRate negativo', async () => {
      qb.getRawMany.mockResolvedValue([
        { type: CategoryType.INCOME, total: '1000' },
        { type: CategoryType.EXPENSE, total: '1500' },
      ]);

      const result = await service.getSummary(USER_ID, {
        month: 1,
        year: 2026,
      });

      expect(result.savingsRate).toBe(-50);
    });

    it('sin datos devuelve todo en 0', async () => {
      const result = await service.getSummary(USER_ID, {
        month: 12,
        year: 2026,
      });

      expect(result).toEqual({
        month: 12,
        year: 2026,
        income: 0,
        expenses: 0,
        balance: 0,
        savingsRate: 0,
        budgets: { total: 0, ok: 0, warning: 0, exceeded: 0 },
        savingsGoals: noGoals,
      });
      expectScopedQuery('2026-12-01', '2027-01-01');
    });

    it('cuenta los presupuestos por estado con BudgetsService.getStatusForMonth', async () => {
      budgetsService.getStatusForMonth.mockResolvedValue([
        { id: 1, status: BudgetStatus.OK },
        { id: 2, status: BudgetStatus.WARNING },
        { id: 3, status: BudgetStatus.EXCEEDED },
        { id: 4, status: BudgetStatus.EXCEEDED },
      ]);

      const result = await service.getSummary(USER_ID, {
        month: 5,
        year: 2026,
      });

      expect(budgetsService.getStatusForMonth).toHaveBeenCalledWith(
        USER_ID,
        5,
        2026,
      );
      expect(result.budgets).toEqual({
        total: 4,
        ok: 1,
        warning: 1,
        exceeded: 2,
      });
    });

    it('incluye el progreso de las metas del usuario', async () => {
      const progress = {
        totalSaved: 3800000,
        totalTarget: 6500000,
        active: 1,
        completed: 1,
      };
      savingsGoalsService.getProgressSummary.mockResolvedValue(progress);

      const result = await service.getSummary(USER_ID, {
        month: 5,
        year: 2026,
      });

      expect(savingsGoalsService.getProgressSummary).toHaveBeenCalledWith(
        USER_ID,
      );
      expect(result.savingsGoals).toEqual(progress);
    });

    it('sin mes ni año usa los actuales en America/Bogota', async () => {
      jest.useFakeTimers({ now: new Date('2026-11-15T12:00:00Z') });

      const result = await service.getSummary(USER_ID);

      expect(result).toMatchObject({ month: 11, year: 2026 });
      expect(budgetsService.getStatusForMonth).toHaveBeenCalledWith(
        USER_ID,
        11,
        2026,
      );
      expectScopedQuery('2026-11-01', '2026-12-01');
    });

    it('a las 8 p. m. del 30 de noviembre en Colombia sigue siendo noviembre', async () => {
      // 2026-12-01T01:00Z ya es diciembre en UTC.
      jest.useFakeTimers({ now: new Date('2026-12-01T01:00:00Z') });

      const result = await service.getSummary(USER_ID);

      expect(result).toMatchObject({ month: 11, year: 2026 });
      expect(budgetsService.getStatusForMonth).toHaveBeenCalledWith(
        USER_ID,
        11,
        2026,
      );
      expectScopedQuery('2026-11-01', '2026-12-01');
    });
  });

  describe('getByCategory', () => {
    it('devuelve total y porcentaje por categoría, ordenado de mayor a menor en SQL', async () => {
      qb.getRawMany.mockResolvedValue([
        { categoryId: 3, name: 'Vivienda', total: '600.00' },
        { categoryId: '5', name: 'Alimentación', total: '300.00' },
        { categoryId: 8, name: 'Ocio', total: '100.00' },
      ]);

      const result = await service.getByCategory(USER_ID, {
        month: 2,
        year: 2026,
        type: CategoryType.EXPENSE,
      });

      expect(result).toEqual({
        month: 2,
        year: 2026,
        type: CategoryType.EXPENSE,
        total: 1000,
        categories: [
          { categoryId: 3, name: 'Vivienda', total: 600, percentage: 60 },
          { categoryId: 5, name: 'Alimentación', total: 300, percentage: 30 },
          { categoryId: 8, name: 'Ocio', total: 100, percentage: 10 },
        ],
      });
      expect(qb.innerJoin).toHaveBeenCalledWith(
        'transaction.category',
        'category',
      );
      expect(qb.groupBy).toHaveBeenCalledWith('category.id');
      expect(qb.orderBy).toHaveBeenCalledWith(
        'SUM(transaction.amount)',
        'DESC',
      );
      expect(qb.addOrderBy).toHaveBeenCalledWith('category.name', 'ASC');
      expect(qb.andWhere).toHaveBeenCalledWith('transaction.type = :type', {
        type: CategoryType.EXPENSE,
      });
      expectScopedQuery('2026-02-01', '2026-03-01');
    });

    it('los porcentajes redondeados suman exactamente 100', async () => {
      qb.getRawMany.mockResolvedValue([
        { categoryId: 1, name: 'A', total: '1' },
        { categoryId: 2, name: 'B', total: '1' },
        { categoryId: 3, name: 'C', total: '1' },
      ]);

      const { categories } = await service.getByCategory(USER_ID, {
        month: 2,
        year: 2026,
      });

      expect(categories.map((c) => c.percentage)).toEqual([
        33.34, 33.33, 33.33,
      ]);
      const sum = categories.reduce((acc, c) => acc + c.percentage * 100, 0);
      expect(sum).toBe(10000);
    });

    it('type por defecto: expense', async () => {
      const result = await service.getByCategory(USER_ID, {
        month: 2,
        year: 2026,
      });

      expect(result.type).toBe(CategoryType.EXPENSE);
      expect(qb.andWhere).toHaveBeenCalledWith('transaction.type = :type', {
        type: CategoryType.EXPENSE,
      });
    });

    it('filtra por income cuando se pide', async () => {
      await service.getByCategory(USER_ID, {
        month: 2,
        year: 2026,
        type: CategoryType.INCOME,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('transaction.type = :type', {
        type: CategoryType.INCOME,
      });
    });

    it('sin datos: total 0 y lista vacía', async () => {
      const result = await service.getByCategory(USER_ID, {
        month: 2,
        year: 2026,
      });

      expect(result).toMatchObject({ total: 0, categories: [] });
    });
  });

  describe('getMonthly', () => {
    it('devuelve los 12 meses con los vacíos en 0 y los totales del año', async () => {
      qb.getRawMany.mockResolvedValue([
        { month: 1, type: CategoryType.INCOME, total: '1000.00' },
        { month: 1, type: CategoryType.EXPENSE, total: '400.25' },
        { month: '3', type: CategoryType.EXPENSE, total: '50.00' },
        { month: 12, type: CategoryType.INCOME, total: '200.00' },
      ]);

      const result = await service.getMonthly(USER_ID, { year: 2025 });

      expect(result.year).toBe(2025);
      expect(result.months).toHaveLength(12);
      expect(result.months.map((m) => m.month)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
      ]);
      expect(result.months[0]).toEqual({
        month: 1,
        income: 1000,
        expenses: 400.25,
        balance: 599.75,
      });
      expect(result.months[1]).toEqual({
        month: 2,
        income: 0,
        expenses: 0,
        balance: 0,
      });
      expect(result.months[2]).toEqual({
        month: 3,
        income: 0,
        expenses: 50,
        balance: -50,
      });
      expect(result.months[11]).toMatchObject({ income: 200, balance: 200 });
      expect(result.totals).toEqual({
        income: 1200,
        expenses: 450.25,
        balance: 749.75,
      });
      expect(qb.groupBy).toHaveBeenCalledWith(
        'CAST(EXTRACT(MONTH FROM transaction.date) AS int)',
      );
      expect(qb.addGroupBy).toHaveBeenCalledWith('transaction.type');
      expectScopedQuery('2025-01-01', '2026-01-01');
    });

    it('sin datos: 12 meses en 0', async () => {
      const result = await service.getMonthly(USER_ID, { year: 2026 });

      expect(result.months).toHaveLength(12);
      expect(
        result.months.every(
          (m) => m.income === 0 && m.expenses === 0 && m.balance === 0,
        ),
      ).toBe(true);
      expect(result.totals).toEqual({ income: 0, expenses: 0, balance: 0 });
    });

    it('sin año usa el actual en America/Bogota', async () => {
      jest.useFakeTimers({ now: new Date('2026-12-31T23:30:00Z') });

      const result = await service.getMonthly(USER_ID);

      expect(result.year).toBe(2026);
      expectScopedQuery('2026-01-01', '2027-01-01');
    });

    it('a las 8 p. m. del 31 de diciembre en Colombia sigue siendo ese año', async () => {
      // 2027-01-01T01:00Z ya es 2027 en UTC.
      jest.useFakeTimers({ now: new Date('2027-01-01T01:00:00Z') });

      const result = await service.getMonthly(USER_ID);

      expect(result.year).toBe(2026);
      expectScopedQuery('2026-01-01', '2027-01-01');
    });
  });

  it('todas las consultas filtran por el userId recibido', async () => {
    await service.getSummary(USER_ID, { month: 1, year: 2026 });
    await service.getByCategory(USER_ID, { month: 1, year: 2026 });
    await service.getMonthly(USER_ID, { year: 2026 });

    expect(transactionsRepository.createQueryBuilder).toHaveBeenCalledTimes(3);
    expect(qb.where).toHaveBeenCalledTimes(3);
    for (const call of qb.where.mock.calls) {
      expect(call).toEqual([
        'transaction.userId = :userId',
        { userId: USER_ID },
      ]);
    }
    expect(budgetsService.getStatusForMonth).toHaveBeenCalledWith(
      USER_ID,
      1,
      2026,
    );
    expect(savingsGoalsService.getProgressSummary).toHaveBeenCalledWith(
      USER_ID,
    );
  });
});

describe('distributePercentages', () => {
  it('sin total devuelve ceros', () => {
    expect(distributePercentages([])).toEqual([]);
    expect(distributePercentages([0, 0])).toEqual([0, 0]);
  });

  it('una sola categoría es el 100 %', () => {
    expect(distributePercentages([123.45])).toEqual([100]);
  });

  it.each([
    [[1, 1, 1]],
    [[2, 1, 1, 1, 1, 1, 1]],
    [[1100000, 220000, 500000, 115000, 90000, 120000, 80000]],
    [[0.01, 0.01, 0.01, 9999999999.99]],
  ])('suma exactamente 100 y conserva el orden: %j', (totals) => {
    const result = distributePercentages(totals);
    const units = result.map((p) => Math.round(p * 100));
    expect(units.reduce((a, b) => a + b, 0)).toBe(10000);
    // Cada valor tiene como máximo 2 decimales.
    result.forEach((p, i) => expect(p).toBe(units[i] / 100));
    // A mayor total, porcentaje mayor o igual.
    const sorted = totals
      .map((total, i) => ({ total, p: result[i] }))
      .sort((a, b) => b.total - a.total);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].p).toBeLessThanOrEqual(sorted[i - 1].p);
    }
  });
});

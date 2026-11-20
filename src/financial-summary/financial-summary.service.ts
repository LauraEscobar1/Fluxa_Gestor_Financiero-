import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { BudgetsService } from '../budgets/budgets.service';
import { BudgetStatus } from '../budgets/enums/budget-status.enum';
import { CategoryType } from '../categories/enums/category-type.enum';
import { currentMonthYear, monthRange, yearRange } from '../common/dates';
import { round2, toAmount } from '../common/numbers';
import { SavingsGoalsService } from '../savings-goals/savings-goals.service';
import { Transaction } from '../transactions/entities/transaction.entity';
import {
  BudgetStatusCountDto,
  CategorySummaryItemDto,
  MonthlySummaryResponseDto,
  MonthlyTotalsDto,
  SummaryByCategoryResponseDto,
  SummaryResponseDto,
} from './dto/summary-response.dto';
import {
  SummaryByCategoryQueryDto,
  SummaryMonthQueryDto,
  SummaryYearQueryDto,
} from './dto/summary-query.dto';

/** 100,00 % expresado en centésimas de punto porcentual. */
const PERCENT_UNITS = 10_000;

/**
 * Reparte el 100 % entre `totals` con 2 decimales usando el método del mayor
 * resto: cada parte recibe la parte entera de su porcentaje (en centésimas) y
 * las centésimas sobrantes van a las de mayor resto. Así la suma es
 * exactamente 100 y el orden de mayor a menor se conserva.
 */
export function distributePercentages(totals: number[]): number[] {
  const sum = totals.reduce((acc, total) => acc + total, 0);
  if (sum <= 0) return totals.map(() => 0);

  const exact = totals.map((total) => (total / sum) * PERCENT_UNITS);
  const units = exact.map((value) => Math.floor(value));
  const leftover = PERCENT_UNITS - units.reduce((acc, value) => acc + value, 0);
  exact
    .map((value, index) => ({ index, remainder: value - units[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .slice(0, leftover)
    .forEach(({ index }) => units[index]++);
  return units.map((value) => value / 100);
}

/** Ingresos, gastos y balance redondeados a partir de las dos sumas. */
function totalsOf(income: number, expenses: number): MonthlyTotalsDto {
  return {
    income: round2(income),
    expenses: round2(expenses),
    balance: round2(income - expenses),
  };
}

/**
 * Resumen financiero de solo lectura (`/summary`). Todas las consultas filtran
 * por el `userId` del token, así que un usuario nunca ve datos de otro.
 *
 * - Las sumas se hacen en Postgres (`SUM` + `GROUP BY`), nunca cargando las
 *   transacciones a memoria. Usa su propio repositorio de `Transaction`
 *   (`forFeature`), igual que `BudgetsModule`.
 * - El estado de los presupuestos sale de `BudgetsService.getStatusForMonth`
 *   y el progreso de las metas de `SavingsGoalsService.getProgressSummary`,
 *   para no duplicar sus reglas.
 * - Mes y año por defecto: los actuales en America/Bogota.
 */
@Injectable()
export class FinancialSummaryService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
    private readonly budgetsService: BudgetsService,
    private readonly savingsGoalsService: SavingsGoalsService,
  ) {}

  /**
   * Ingresos, gastos, balance y tasa de ahorro del mes, conteo de presupuestos
   * por estado y progreso de las metas de ahorro.
   */
  async getSummary(
    userId: number,
    query: SummaryMonthQueryDto = {},
  ): Promise<SummaryResponseDto> {
    const { month, year } = this.resolveMonth(query);
    const { start, end } = monthRange(month, year);

    const [rows, budgets, savingsGoals] = await Promise.all([
      this.transactionsBetween(userId, start, end)
        .select('transaction.type', 'type')
        .addSelect('SUM(transaction.amount)', 'total')
        .groupBy('transaction.type')
        .getRawMany<{ type: CategoryType; total: string | null }>(),
      this.budgetsService.getStatusForMonth(userId, month, year),
      this.savingsGoalsService.getProgressSummary(userId),
    ]);

    const sumOf = (type: CategoryType) =>
      toAmount(rows.find((row) => row.type === type)?.total);
    const totals = totalsOf(
      sumOf(CategoryType.INCOME),
      sumOf(CategoryType.EXPENSE),
    );

    const countOf = (status: BudgetStatus) =>
      budgets.filter((budget) => budget.status === status).length;
    const budgetCount: BudgetStatusCountDto = {
      total: budgets.length,
      ok: countOf(BudgetStatus.OK),
      warning: countOf(BudgetStatus.WARNING),
      exceeded: countOf(BudgetStatus.EXCEEDED),
    };

    return {
      month,
      year,
      ...totals,
      savingsRate:
        totals.income > 0 ? round2((totals.balance / totals.income) * 100) : 0,
      budgets: budgetCount,
      savingsGoals,
    };
  }

  /**
   * Total y porcentaje por categoría de un tipo (por defecto `expense`) en el
   * mes, de mayor a menor total. Solo aparecen categorías con movimientos.
   */
  async getByCategory(
    userId: number,
    query: SummaryByCategoryQueryDto = {},
  ): Promise<SummaryByCategoryResponseDto> {
    const { month, year } = this.resolveMonth(query);
    const type = query.type ?? CategoryType.EXPENSE;
    const { start, end } = monthRange(month, year);

    const rows = await this.transactionsBetween(userId, start, end)
      .innerJoin('transaction.category', 'category')
      .select('category.id', 'categoryId')
      .addSelect('category.name', 'name')
      .addSelect('SUM(transaction.amount)', 'total')
      .andWhere('transaction.type = :type', { type })
      .groupBy('category.id')
      .addGroupBy('category.name')
      .orderBy('SUM(transaction.amount)', 'DESC')
      .addOrderBy('category.name', 'ASC')
      .getRawMany<{
        categoryId: number | string;
        name: string;
        total: string | null;
      }>();

    const totals = rows.map((row) => toAmount(row.total));
    const percentages = distributePercentages(totals);
    const categories: CategorySummaryItemDto[] = rows.map((row, index) => ({
      categoryId: Number(row.categoryId),
      name: row.name,
      total: totals[index],
      percentage: percentages[index],
    }));

    return {
      month,
      year,
      type,
      total: round2(totals.reduce((acc, total) => acc + total, 0)),
      categories,
    };
  }

  /**
   * Ingresos, gastos y balance de los 12 meses del año (los meses sin
   * movimientos van en 0) y los totales del año.
   */
  async getMonthly(
    userId: number,
    query: SummaryYearQueryDto = {},
  ): Promise<MonthlySummaryResponseDto> {
    const year = query.year ?? currentMonthYear().year;
    const { start, end } = yearRange(year);
    const monthExpression = 'CAST(EXTRACT(MONTH FROM transaction.date) AS int)';

    const rows = await this.transactionsBetween(userId, start, end)
      .select(monthExpression, 'month')
      .addSelect('transaction.type', 'type')
      .addSelect('SUM(transaction.amount)', 'total')
      .groupBy(monthExpression)
      .addGroupBy('transaction.type')
      .getRawMany<{
        month: number | string;
        type: CategoryType;
        total: string | null;
      }>();

    const income = Array.from({ length: 12 }, () => 0);
    const expenses = Array.from({ length: 12 }, () => 0);
    for (const row of rows) {
      const target = row.type === CategoryType.INCOME ? income : expenses;
      target[Number(row.month) - 1] = toAmount(row.total);
    }

    return {
      year,
      months: income.map((_, index) => ({
        month: index + 1,
        ...totalsOf(income[index], expenses[index]),
      })),
      totals: totalsOf(
        income.reduce((acc, value) => acc + value, 0),
        expenses.reduce((acc, value) => acc + value, 0),
      ),
    };
  }

  /** Mes y año pedidos o, si faltan, los actuales en America/Bogota. */
  private resolveMonth(query: SummaryMonthQueryDto): {
    month: number;
    year: number;
  } {
    const current = currentMonthYear();
    return {
      month: query.month ?? current.month,
      year: query.year ?? current.year,
    };
  }

  /**
   * Consulta base: transacciones del usuario con fecha en `[start, end)`
   * (comparación de texto `YYYY-MM-DD`, aprovecha el índice `user_id, date`).
   */
  private transactionsBetween(
    userId: number,
    start: string,
    end: string,
  ): SelectQueryBuilder<Transaction> {
    return this.transactionsRepository
      .createQueryBuilder('transaction')
      .where('transaction.userId = :userId', { userId })
      .andWhere('transaction.date >= :start', { start })
      .andWhere('transaction.date < :end', { end });
  }
}

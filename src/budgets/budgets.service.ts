import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { CategoryType } from '../categories/enums/category-type.enum';
import { monthRange } from '../common/dates';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { round2 } from '../common/numbers';
import { Transaction } from '../transactions/entities/transaction.entity';
import { BudgetResponseDto } from './dto/budget-response.dto';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { ListBudgetsQueryDto } from './dto/list-budgets-query.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { Budget } from './entities/budget.entity';
import { BudgetStatus } from './enums/budget-status.enum';

/** Porcentaje de uso desde el que un presupuesto pasa a "warning". */
const WARNING_THRESHOLD = 80;

/**
 * Presupuestos mensuales del usuario. Todos los métodos reciben `userId` y
 * filtran por él: un presupuesto de otro usuario se trata como inexistente
 * (404). `spent`, `remaining`, `percentUsed` y `status` no se guardan: se
 * calculan con las transacciones de gasto de la categoría en ese mes.
 */
@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private readonly budgetsRepository: Repository<Budget>,
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
    private readonly categoriesService: CategoriesService,
  ) {}

  /**
   * Lista los presupuestos de un mes (por defecto el actual, en UTC) ordenados
   * por nombre de categoría. Es lo que lista `GET /budgets`.
   */
  findAll(
    userId: number,
    query: ListBudgetsQueryDto = {},
  ): Promise<BudgetResponseDto[]> {
    const now = new Date();
    return this.getStatusForMonth(
      userId,
      query.month ?? now.getUTCMonth() + 1,
      query.year ?? now.getUTCFullYear(),
    );
  }

  /**
   * Presupuestos del usuario de un mes con sus campos calculados. Reutilizable
   * por otros módulos (p. ej. el resumen). Usa una sola consulta agregada para
   * calcular lo gastado en todas las categorías (sin N+1).
   */
  async getStatusForMonth(
    userId: number,
    month: number,
    year: number,
  ): Promise<BudgetResponseDto[]> {
    const budgets = await this.withCategory(userId)
      .andWhere('budget.month = :month', { month })
      .andWhere('budget.year = :year', { year })
      .orderBy('category.name', 'ASC')
      .addOrderBy('budget.id', 'ASC')
      .getMany();
    return this.withSpent(userId, budgets, month, year);
  }

  /**
   * Obtiene un presupuesto del usuario con sus campos calculados.
   * @throws NotFoundException si no existe o es de otro usuario.
   */
  async findOne(userId: number, id: number): Promise<BudgetResponseDto> {
    const budget = await this.withCategory(userId)
      .andWhere('budget.id = :id', { id })
      .getOne();
    if (!budget) {
      throw new NotFoundException('Presupuesto no encontrado');
    }
    const [response] = await this.withSpent(
      userId,
      [budget],
      budget.month,
      budget.year,
    );
    return response;
  }

  /**
   * Crea un presupuesto.
   * @throws NotFoundException si la categoría no existe o es de otro usuario.
   * @throws BadRequestException si la categoría no es de tipo "expense".
   * @throws ConflictException si ya hay presupuesto para esa categoría y mes.
   */
  async create(
    userId: number,
    dto: CreateBudgetDto,
  ): Promise<BudgetResponseDto> {
    const category = await this.categoriesService.findOne(
      userId,
      dto.categoryId,
    );
    if (category.type !== CategoryType.EXPENSE) {
      throw new BadRequestException(
        'Solo se pueden crear presupuestos para categorías de gastos',
      );
    }
    const exists = await this.budgetsRepository.existsBy({
      userId,
      categoryId: dto.categoryId,
      month: dto.month,
      year: dto.year,
    });
    if (exists) {
      throw new ConflictException(
        'Ya existe un presupuesto para esa categoría en ese mes',
      );
    }

    const saved = await this.budgetsRepository.save(
      this.budgetsRepository.create({
        userId,
        categoryId: dto.categoryId,
        amount: dto.amount,
        month: dto.month,
        year: dto.year,
      }),
    );
    return this.findOne(userId, saved.id);
  }

  /**
   * Cambia el monto (categoría, mes y año no se pueden modificar).
   * @throws NotFoundException si no existe o es de otro usuario.
   */
  async update(
    userId: number,
    id: number,
    dto: UpdateBudgetDto,
  ): Promise<BudgetResponseDto> {
    const budget = await this.budgetsRepository.findOneBy({ id, userId });
    if (!budget) {
      throw new NotFoundException('Presupuesto no encontrado');
    }
    budget.amount = dto.amount;
    await this.budgetsRepository.save(budget);
    return this.findOne(userId, id);
  }

  /**
   * Elimina un presupuesto.
   * @throws NotFoundException si no existe o es de otro usuario.
   */
  async remove(userId: number, id: number): Promise<MessageResponseDto> {
    const { affected } = await this.budgetsRepository.delete({ id, userId });
    if (!affected) {
      throw new NotFoundException('Presupuesto no encontrado');
    }
    return { message: 'Presupuesto eliminado correctamente' };
  }

  /** Consulta base: presupuestos del usuario con id y nombre de su categoría. */
  private withCategory(userId: number): SelectQueryBuilder<Budget> {
    return this.budgetsRepository
      .createQueryBuilder('budget')
      .innerJoin('budget.category', 'category')
      .addSelect(['category.id', 'category.name'])
      .where('budget.userId = :userId', { userId });
  }

  /**
   * Completa los presupuestos de un mismo mes con los campos calculados. Lo
   * gastado de todas las categorías sale de UNA consulta con GROUP BY.
   */
  private async withSpent(
    userId: number,
    budgets: Budget[],
    month: number,
    year: number,
  ): Promise<BudgetResponseDto[]> {
    if (budgets.length === 0) return [];

    const { start, end } = monthRange(month, year);
    const rows = await this.transactionsRepository
      .createQueryBuilder('transaction')
      .select('transaction.categoryId', 'categoryId')
      .addSelect('SUM(transaction.amount)', 'spent')
      .where('transaction.userId = :userId', { userId })
      .andWhere('transaction.type = :type', { type: CategoryType.EXPENSE })
      .andWhere('transaction.categoryId IN (:...categoryIds)', {
        categoryIds: budgets.map((budget) => budget.categoryId),
      })
      .andWhere('transaction.date >= :start', { start })
      .andWhere('transaction.date < :end', { end })
      .groupBy('transaction.categoryId')
      .getRawMany<{ categoryId: number | string; spent: string | null }>();

    const spentByCategory = new Map(
      rows.map((row) => [Number(row.categoryId), Number(row.spent ?? 0)]),
    );
    return budgets.map((budget) =>
      this.toResponse(budget, spentByCategory.get(budget.categoryId) ?? 0),
    );
  }

  private toResponse(budget: Budget, rawSpent: number): BudgetResponseDto {
    const spent = round2(rawSpent);
    const percentUsed =
      budget.amount > 0 ? round2((spent / budget.amount) * 100) : 0;
    let status = BudgetStatus.OK;
    if (spent > budget.amount) {
      status = BudgetStatus.EXCEEDED;
    } else if (percentUsed >= WARNING_THRESHOLD) {
      status = BudgetStatus.WARNING;
    }
    return {
      id: budget.id,
      categoryId: budget.categoryId,
      category: { id: budget.category!.id, name: budget.category!.name },
      amount: budget.amount,
      month: budget.month,
      year: budget.year,
      spent,
      remaining: round2(budget.amount - spent),
      percentUsed,
      status,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  }
}

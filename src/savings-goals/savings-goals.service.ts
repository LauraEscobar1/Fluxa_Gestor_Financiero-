import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { toDateOnly } from '../common/dates';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import {
  Paginated,
  PaginationQueryDto,
  pageOptions,
  paginated,
} from '../common/pagination';
import { CreateMovementDto } from './dto/create-movement.dto';
import { CreateSavingsGoalDto } from './dto/create-savings-goal.dto';
import { ListSavingsGoalsQueryDto } from './dto/list-savings-goals-query.dto';
import {
  SavingsGoalMovementResponseDto,
  SavingsGoalMovementResultDto,
  SavingsGoalResponseDto,
} from './dto/savings-goal-response.dto';
import { UpdateSavingsGoalDto } from './dto/update-savings-goal.dto';
import { SavingsGoalMovement } from './entities/savings-goal-movement.entity';
import { SavingsGoal } from './entities/savings-goal.entity';
import { SavingsGoalMovementType } from './enums/savings-goal-movement-type.enum';
import { SavingsGoalStatus } from './enums/savings-goal-status.enum';

/** Mensaje de 404 para metas inexistentes o de otro usuario. */
const GOAL_NOT_FOUND = 'Meta de ahorro no encontrada';

/** Código SQLSTATE de Postgres para desbordamiento numérico (`decimal(12,2)`). */
const NUMERIC_VALUE_OUT_OF_RANGE = '22003';

/** Mayor porcentaje que se muestra mientras la meta sigue activa. */
const MAX_ACTIVE_PERCENT = 99.99;

/** Redondea a 2 decimales (evita ruido de coma flotante como 0.1 + 0.2). */
const round2 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Metas de ahorro del usuario con depósitos, retiros e historial. Todos los
 * métodos reciben `userId` y filtran por él: una meta de otro usuario se trata
 * como inexistente (404). `status`, `progressPercent` y `remaining` no se
 * guardan: se calculan a partir de `currentAmount` y `targetAmount`.
 */
@Injectable()
export class SavingsGoalsService {
  constructor(
    @InjectRepository(SavingsGoal)
    private readonly goalsRepository: Repository<SavingsGoal>,
    @InjectRepository(SavingsGoalMovement)
    private readonly movementsRepository: Repository<SavingsGoalMovement>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Lista paginada de las metas del usuario, de la más reciente a la más
   * antigua. El filtro por estado se traduce a una condición SQL sobre el saldo
   * (el estado no es una columna), así `total` y la paginación son correctos.
   */
  async findAll(
    userId: number,
    query: ListSavingsGoalsQueryDto,
  ): Promise<Paginated<SavingsGoalResponseDto>> {
    const qb = this.goalsRepository
      .createQueryBuilder('goal')
      .where('goal.userId = :userId', { userId });
    if (query.status === SavingsGoalStatus.COMPLETED) {
      qb.andWhere('goal.currentAmount >= goal.targetAmount');
    } else if (query.status === SavingsGoalStatus.ACTIVE) {
      qb.andWhere('goal.currentAmount < goal.targetAmount');
    }

    const { skip, take } = pageOptions(query);
    const [goals, total] = await qb
      .orderBy('goal.createdAt', 'DESC')
      .addOrderBy('goal.id', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
    return paginated(
      goals.map((goal) => this.toResponse(goal)),
      total,
      query,
    );
  }

  /**
   * Obtiene una meta del usuario con sus campos calculados.
   * @throws NotFoundException si no existe o es de otro usuario.
   */
  async findOne(userId: number, id: number): Promise<SavingsGoalResponseDto> {
    const goal = await this.goalsRepository.findOneBy({ id, userId });
    if (!goal) {
      throw new NotFoundException(GOAL_NOT_FOUND);
    }
    return this.toResponse(goal);
  }

  /**
   * Crea una meta con saldo 0.
   * @throws BadRequestException si `targetDate` está en el pasado.
   */
  async create(
    userId: number,
    dto: CreateSavingsGoalDto,
  ): Promise<SavingsGoalResponseDto> {
    if (dto.targetDate) {
      this.assertTargetDateNotPast(dto.targetDate);
    }
    const saved = await this.goalsRepository.save(
      this.goalsRepository.create({
        userId,
        name: dto.name,
        targetAmount: dto.targetAmount,
        currentAmount: 0,
        targetDate: dto.targetDate ?? null,
      }),
    );
    return this.findOne(userId, saved.id);
  }

  /**
   * Actualización parcial de nombre, objetivo y fecha límite. Si el objetivo
   * queda por debajo del saldo, la meta pasa a "completed" (no es un error).
   *
   * Usa `update()` con solo las columnas editadas en lugar de `save()`:
   * `save()` reescribiría todas las columnas que difieran de la fila actual,
   * incluido un `currentAmount` leído antes de un depósito concurrente, y se
   * perdería ese depósito.
   * @throws NotFoundException si no existe o es de otro usuario.
   * @throws BadRequestException si la nueva `targetDate` está en el pasado.
   */
  async update(
    userId: number,
    id: number,
    dto: UpdateSavingsGoalDto,
  ): Promise<SavingsGoalResponseDto> {
    if (dto.targetDate) {
      this.assertTargetDateNotPast(dto.targetDate);
    }
    const changes: Partial<SavingsGoal> = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.targetAmount !== undefined && { targetAmount: dto.targetAmount }),
      ...(dto.targetDate !== undefined && { targetDate: dto.targetDate }),
    };
    if (Object.keys(changes).length > 0) {
      const { affected } = await this.goalsRepository.update(
        { id, userId },
        changes,
      );
      if (!affected) {
        throw new NotFoundException(GOAL_NOT_FOUND);
      }
    }
    return this.findOne(userId, id);
  }

  /**
   * Elimina una meta y, en cascada, su historial de movimientos.
   * @throws NotFoundException si no existe o es de otro usuario.
   */
  async remove(userId: number, id: number): Promise<MessageResponseDto> {
    const { affected } = await this.goalsRepository.delete({ id, userId });
    if (!affected) {
      throw new NotFoundException(GOAL_NOT_FOUND);
    }
    return { message: 'Meta de ahorro eliminada correctamente' };
  }

  /**
   * Suma `amount` al saldo de la meta y registra el depósito.
   * @throws NotFoundException si no existe o es de otro usuario.
   * @throws BadRequestException si el saldo superaría el máximo de `decimal(12,2)`.
   */
  deposit(
    userId: number,
    id: number,
    dto: CreateMovementDto,
  ): Promise<SavingsGoalMovementResultDto> {
    return this.applyMovement(
      userId,
      id,
      dto.amount,
      SavingsGoalMovementType.DEPOSIT,
    );
  }

  /**
   * Resta `amount` del saldo de la meta y registra el retiro.
   * @throws NotFoundException si no existe o es de otro usuario.
   * @throws BadRequestException si el saldo quedaría por debajo de 0.
   */
  withdraw(
    userId: number,
    id: number,
    dto: CreateMovementDto,
  ): Promise<SavingsGoalMovementResultDto> {
    return this.applyMovement(
      userId,
      id,
      dto.amount,
      SavingsGoalMovementType.WITHDRAWAL,
    );
  }

  /**
   * Historial paginado de una meta, del movimiento más reciente al más
   * antiguo.
   * @throws NotFoundException si la meta no existe o es de otro usuario.
   */
  async findMovements(
    userId: number,
    id: number,
    query: PaginationQueryDto,
  ): Promise<Paginated<SavingsGoalMovementResponseDto>> {
    const exists = await this.goalsRepository.existsBy({ id, userId });
    if (!exists) {
      throw new NotFoundException(GOAL_NOT_FOUND);
    }
    const [movements, total] = await this.movementsRepository.findAndCount({
      where: { goalId: id },
      order: { createdAt: 'DESC', id: 'DESC' },
      ...pageOptions(query),
    });
    return paginated(
      movements.map((movement) => this.toMovementResponse(movement)),
      total,
      query,
    );
  }

  /**
   * Aplica un depósito o retiro de forma atómica y consistente ante
   * peticiones concurrentes.
   *
   * - **Atomicidad**: el cambio de saldo y el registro del movimiento van en la
   *   misma transacción (`DataSource.transaction`); si falla el INSERT del
   *   movimiento, el saldo se revierte y nunca quedan desalineados.
   * - **Sin actualizaciones perdidas**: el saldo no se lee, se modifica en
   *   memoria y se guarda (read-modify-write), porque dos peticiones
   *   simultáneas leerían el mismo saldo y la segunda pisaría a la primera. En
   *   su lugar se ejecuta `UPDATE ... SET current_amount = current_amount ± :amount`:
   *   Postgres calcula el nuevo valor sobre la versión vigente de la fila y
   *   la bloquea hasta el COMMIT, así que la otra petición espera y suma sobre
   *   el resultado ya confirmado.
   * - **Retiro sin saldo negativo**: la condición `current_amount >= :amount`
   *   va dentro del propio UPDATE (no en una comprobación previa en Node), de
   *   modo que se evalúa contra el saldo vigente en el momento de escribir. Si
   *   se comprobara antes, dos retiros simultáneos podrían pasar ambos la
   *   comprobación y dejar el saldo en negativo.
   *
   * Si el UPDATE no afecta a ninguna fila, la meta no existe / es de otro
   * usuario (404) o, en un retiro, el saldo no alcanza (400). La meta se
   * relee dentro de la transacción, cuando la fila ya está bloqueada por
   * nuestro UPDATE, así que el saldo devuelto es exactamente el que dejamos.
   */
  private async applyMovement(
    userId: number,
    id: number,
    amount: number,
    type: SavingsGoalMovementType,
  ): Promise<SavingsGoalMovementResultDto> {
    const isWithdrawal = type === SavingsGoalMovementType.WITHDRAWAL;
    try {
      return await this.dataSource.transaction(async (manager) => {
        const goals = manager.getRepository(SavingsGoal);
        const movements = manager.getRepository(SavingsGoalMovement);

        const update = goals
          .createQueryBuilder()
          .update()
          .set({
            currentAmount: () =>
              `current_amount ${isWithdrawal ? '-' : '+'} :amount`,
          })
          .where('id = :id', { id })
          .andWhere('user_id = :userId', { userId })
          .setParameter('amount', amount);
        if (isWithdrawal) {
          update.andWhere('current_amount >= :amount');
        }
        const { affected } = await update.execute();

        if (!affected) {
          if (isWithdrawal && (await goals.existsBy({ id, userId }))) {
            throw new BadRequestException('Fondos insuficientes en la meta');
          }
          throw new NotFoundException(GOAL_NOT_FOUND);
        }

        const movement = await movements.save(
          movements.create({ goalId: id, amount, type }),
        );
        const goal = await goals.findOneByOrFail({ id, userId });
        return {
          movement: this.toMovementResponse(movement),
          goal: this.toResponse(goal),
        };
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as QueryFailedError & { driverError?: { code?: string } })
          .driverError?.code === NUMERIC_VALUE_OUT_OF_RANGE
      ) {
        throw new BadRequestException(
          'El depósito superaría el saldo máximo permitido en la meta',
        );
      }
      throw error;
    }
  }

  /** @throws BadRequestException si `targetDate` es anterior a hoy (UTC). */
  private assertTargetDateNotPast(targetDate: string): void {
    const today = toDateOnly(new Date());
    if (targetDate < today) {
      throw new BadRequestException(
        `La fecha objetivo no puede estar en el pasado (hoy es ${today})`,
      );
    }
  }

  /**
   * Agrega los campos calculados. `progressPercent` se redondea a 2 decimales
   * con tope en 100, y solo vale 100 si la meta está completada (p. ej.
   * 9 999.99 de 10 000 da 99.99, no 100).
   */
  private toResponse(goal: SavingsGoal): SavingsGoalResponseDto {
    const completed = goal.currentAmount >= goal.targetAmount;
    const percent = round2((goal.currentAmount / goal.targetAmount) * 100);
    return {
      id: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      targetDate: goal.targetDate,
      status: completed
        ? SavingsGoalStatus.COMPLETED
        : SavingsGoalStatus.ACTIVE,
      progressPercent: completed ? 100 : Math.min(percent, MAX_ACTIVE_PERCENT),
      remaining: round2(Math.max(goal.targetAmount - goal.currentAmount, 0)),
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    };
  }

  private toMovementResponse(
    movement: SavingsGoalMovement,
  ): SavingsGoalMovementResponseDto {
    return {
      id: movement.id,
      goalId: movement.goalId,
      amount: movement.amount,
      type: movement.type,
      createdAt: movement.createdAt,
    };
  }
}

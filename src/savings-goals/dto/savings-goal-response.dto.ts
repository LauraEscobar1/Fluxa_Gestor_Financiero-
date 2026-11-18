import { ApiProperty } from '@nestjs/swagger';
import type { Paginated } from '../../common/pagination';
import { SavingsGoalMovementType } from '../enums/savings-goal-movement-type.enum';
import { SavingsGoalStatus } from '../enums/savings-goal-status.enum';

/** Meta de ahorro con los campos calculados a partir del saldo. */
export class SavingsGoalResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Viaje a Cartagena', maxLength: 150 })
  name: string;

  @ApiProperty({ example: 3000000 })
  targetAmount: number;

  @ApiProperty({
    example: 1200000,
    description: 'Saldo acumulado; solo cambia con depósitos y retiros',
  })
  currentAmount: number;

  @ApiProperty({
    example: '2027-06-30',
    format: 'date',
    nullable: true,
    type: String,
  })
  targetDate: string | null;

  @ApiProperty({
    enum: SavingsGoalStatus,
    example: SavingsGoalStatus.ACTIVE,
    description: '"completed" si currentAmount >= targetAmount',
  })
  status: SavingsGoalStatus;

  @ApiProperty({
    example: 40,
    description:
      'currentAmount / targetAmount * 100 con 2 decimales y tope en 100 (solo vale 100 si está completada)',
  })
  progressPercent: number;

  @ApiProperty({
    example: 1800000,
    description: 'max(targetAmount - currentAmount, 0)',
  })
  remaining: number;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  updatedAt: Date;
}

/** Movimiento del historial de una meta. */
export class SavingsGoalMovementResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  goalId: number;

  @ApiProperty({ example: 150000, description: 'Siempre positivo' })
  amount: number;

  @ApiProperty({
    enum: SavingsGoalMovementType,
    example: SavingsGoalMovementType.DEPOSIT,
  })
  type: SavingsGoalMovementType;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt: Date;
}

/** Respuesta de un depósito o retiro: el movimiento y la meta actualizada. */
export class SavingsGoalMovementResultDto {
  @ApiProperty({ type: () => SavingsGoalMovementResponseDto })
  movement: SavingsGoalMovementResponseDto;

  @ApiProperty({ type: () => SavingsGoalResponseDto })
  goal: SavingsGoalResponseDto;
}

/** Respuesta de `GET /savings-goals` (solo para documentar en Swagger). */
export class PaginatedSavingsGoalsDto implements Paginated<SavingsGoalResponseDto> {
  @ApiProperty({ type: [SavingsGoalResponseDto] })
  data: SavingsGoalResponseDto[];

  @ApiProperty({ example: 3 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}

/** Respuesta de `GET /savings-goals/:id/movements` (solo para Swagger). */
export class PaginatedSavingsGoalMovementsDto implements Paginated<SavingsGoalMovementResponseDto> {
  @ApiProperty({ type: [SavingsGoalMovementResponseDto] })
  data: SavingsGoalMovementResponseDto[];

  @ApiProperty({ example: 12 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}

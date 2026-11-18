import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '../../categories/enums/category-type.enum';
import { SavingsGoalsProgressDto } from '../../savings-goals/dto/savings-goals-progress.dto';

/** Número de presupuestos del mes en cada estado. */
export class BudgetStatusCountDto {
  @ApiProperty({ example: 3, description: 'Presupuestos del mes' })
  total: number;

  @ApiProperty({ example: 1 })
  ok: number;

  @ApiProperty({
    example: 1,
    description: 'percentUsed >= 80 sin superar el límite',
  })
  warning: number;

  @ApiProperty({ example: 1, description: 'spent > amount' })
  exceeded: number;
}

/** Respuesta de `GET /summary`: panorama del mes para el dashboard. */
export class SummaryResponseDto {
  @ApiProperty({ example: 1, minimum: 1, maximum: 12 })
  month: number;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 4100000, description: 'Suma de ingresos del mes' })
  income: number;

  @ApiProperty({ example: 2225000, description: 'Suma de gastos del mes' })
  expenses: number;

  @ApiProperty({
    example: 1875000,
    description: 'income - expenses (negativo si se gastó más de lo ingresado)',
  })
  balance: number;

  @ApiProperty({
    example: 45.73,
    description:
      'balance / income * 100, redondeado a 2 decimales; 0 si no hay ingresos. Negativo si los gastos superan a los ingresos',
  })
  savingsRate: number;

  @ApiProperty({ type: () => BudgetStatusCountDto })
  budgets: BudgetStatusCountDto;

  @ApiProperty({ type: () => SavingsGoalsProgressDto })
  savingsGoals: SavingsGoalsProgressDto;
}

/** Total de una categoría dentro de `GET /summary/by-category`. */
export class CategorySummaryItemDto {
  @ApiProperty({ example: 3 })
  categoryId: number;

  @ApiProperty({ example: 'Vivienda' })
  name: string;

  @ApiProperty({ example: 1100000 })
  total: number;

  @ApiProperty({
    example: 49.44,
    description:
      'Porcentaje sobre el total del tipo, a 2 decimales; la suma de todas las categorías es exactamente 100',
  })
  percentage: number;
}

/** Respuesta de `GET /summary/by-category`. */
export class SummaryByCategoryResponseDto {
  @ApiProperty({ example: 1, minimum: 1, maximum: 12 })
  month: number;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ enum: CategoryType, example: CategoryType.EXPENSE })
  type: CategoryType;

  @ApiProperty({
    example: 2225000,
    description: 'Suma de todas las categorías',
  })
  total: number;

  @ApiProperty({
    type: [CategorySummaryItemDto],
    description:
      'Solo categorías con movimientos, de mayor a menor total (empate: por nombre)',
  })
  categories: CategorySummaryItemDto[];
}

/** Ingresos, gastos y balance de un mes o de un año. */
export class MonthlyTotalsDto {
  @ApiProperty({ example: 4100000 })
  income: number;

  @ApiProperty({ example: 2225000 })
  expenses: number;

  @ApiProperty({ example: 1875000, description: 'income - expenses' })
  balance: number;
}

/** Totales de un mes dentro de `GET /summary/monthly`. */
export class MonthlySummaryItemDto extends MonthlyTotalsDto {
  @ApiProperty({ example: 1, minimum: 1, maximum: 12 })
  month: number;
}

/** Respuesta de `GET /summary/monthly`. */
export class MonthlySummaryResponseDto {
  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({
    type: [MonthlySummaryItemDto],
    description:
      'Siempre 12 elementos (enero a diciembre); meses sin datos en 0',
  })
  months: MonthlySummaryItemDto[];

  @ApiProperty({ type: () => MonthlyTotalsDto, description: 'Totales del año' })
  totals: MonthlyTotalsDto;
}

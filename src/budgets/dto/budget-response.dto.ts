import { ApiProperty, PickType } from '@nestjs/swagger';
import { Category } from '../../categories/entities/category.entity';
import { BudgetStatus } from '../enums/budget-status.enum';

/** Datos de la categoría que se incluyen en cada presupuesto. */
export class BudgetCategoryDto extends PickType(Category, [
  'id',
  'name',
] as const) {}

/** Presupuesto con los campos calculados a partir de las transacciones. */
export class BudgetResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 3 })
  categoryId: number;

  @ApiProperty({ type: () => BudgetCategoryDto })
  category: BudgetCategoryDto;

  @ApiProperty({ example: 500000, description: 'Límite del mes' })
  amount: number;

  @ApiProperty({ example: 1, minimum: 1, maximum: 12 })
  month: number;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({
    example: 410000,
    description: 'Suma de los gastos de la categoría en ese mes (0 si no hay)',
  })
  spent: number;

  @ApiProperty({
    example: 90000,
    description: 'amount - spent; negativo si se superó el límite',
  })
  remaining: number;

  @ApiProperty({
    example: 82,
    description: 'spent / amount * 100, redondeado a 2 decimales',
  })
  percentUsed: number;

  @ApiProperty({
    enum: BudgetStatus,
    example: BudgetStatus.WARNING,
    description: '"warning" si percentUsed >= 80; "exceeded" si spent > amount',
  })
  status: BudgetStatus;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  updatedAt: Date;
}

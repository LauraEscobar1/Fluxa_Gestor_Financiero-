import { PickType } from '@nestjs/swagger';
import { CreateBudgetDto } from './create-budget.dto';

/**
 * Body de `PATCH /budgets/:id`. Solo se puede cambiar el monto: categoría,
 * mes y año identifican el presupuesto. Como `amount` es el único campo
 * editable, es obligatorio (así tampoco admite `{}` ni `null`).
 */
export class UpdateBudgetDto extends PickType(CreateBudgetDto, [
  'amount',
] as const) {}

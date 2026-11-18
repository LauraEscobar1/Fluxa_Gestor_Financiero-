import { PartialType } from '@nestjs/swagger';
import { CreateSavingsGoalDto } from './create-savings-goal.dto';

/**
 * Body de `PATCH /savings-goals/:id`. Todos los campos son opcionales, pero
 * `skipNullProperties: false` hace que un `null` en `name` o `targetAmount`
 * se valide (y se rechace con 400). `targetDate` admite `null` para quitar la
 * fecha límite. `currentAmount` no se puede editar: solo cambia con depósitos
 * y retiros (`forbidNonWhitelisted` lo rechaza con 400).
 */
export class UpdateSavingsGoalDto extends PartialType(CreateSavingsGoalDto, {
  skipNullProperties: false,
}) {}

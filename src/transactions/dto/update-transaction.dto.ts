import { PartialType } from '@nestjs/swagger';
import { CreateTransactionDto } from './create-transaction.dto';

/**
 * Body de `PATCH /transactions/:id`. Todos los campos son opcionales, pero
 * `skipNullProperties: false` hace que un `null` se valide (y se rechace con
 * 400) en lugar de llegar al servicio. La excepción es `description`, que
 * admite `null` para borrarla.
 */
export class UpdateTransactionDto extends PartialType(CreateTransactionDto, {
  skipNullProperties: false,
}) {}

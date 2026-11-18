import { PickType } from '@nestjs/swagger';
import { Category } from '../../categories/entities/category.entity';

/** Datos de la categoría que se incluyen en cada transacción devuelta. */
export class TransactionCategoryDto extends PickType(Category, [
  'id',
  'name',
  'type',
] as const) {}

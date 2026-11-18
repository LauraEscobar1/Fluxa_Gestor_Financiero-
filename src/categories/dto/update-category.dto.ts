import { PickType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';

/**
 * Body de `PATCH /categories/:id`. Solo se puede cambiar el nombre: el tipo
 * es inmutable porque rompería las transacciones asociadas. Como `name` es
 * el único campo editable, es obligatorio (así tampoco admite `null`).
 */
export class UpdateCategoryDto extends PickType(CreateCategoryDto, [
  'name',
] as const) {}

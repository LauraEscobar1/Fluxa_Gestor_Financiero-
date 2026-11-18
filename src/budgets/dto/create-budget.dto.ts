import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsPositive, Max, Min } from 'class-validator';
import { MAX_AMOUNT } from '../../transactions/dto/create-transaction.dto';

/** Rango de años admitido en un presupuesto. */
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

/** Body de `POST /budgets`. */
export class CreateBudgetDto {
  @ApiProperty({
    example: 3,
    description: 'Categoría propia de tipo "expense"',
  })
  @IsInt({ message: 'La categoría debe ser un id entero' })
  @Min(1, { message: 'La categoría debe ser un id válido' })
  categoryId: number;

  @ApiProperty({
    example: 500000,
    description: 'Límite del mes. Mayor que 0, con 2 decimales como máximo',
    maximum: MAX_AMOUNT,
  })
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: 'El monto debe ser un número con 2 decimales como máximo' },
  )
  @IsPositive({ message: 'El monto debe ser mayor que 0' })
  @Max(MAX_AMOUNT, { message: `El monto no puede superar ${MAX_AMOUNT}` })
  amount: number;

  @ApiProperty({ example: 1, minimum: 1, maximum: 12 })
  @IsInt({ message: 'El mes debe ser un número entero' })
  @Min(1, { message: 'El mes debe estar entre 1 y 12' })
  @Max(12, { message: 'El mes debe estar entre 1 y 12' })
  month: number;

  @ApiProperty({ example: 2026, minimum: MIN_YEAR, maximum: MAX_YEAR })
  @IsInt({ message: 'El año debe ser un número entero' })
  @Min(MIN_YEAR, {
    message: `El año debe estar entre ${MIN_YEAR} y ${MAX_YEAR}`,
  })
  @Max(MAX_YEAR, {
    message: `El año debe estar entre ${MIN_YEAR} y ${MAX_YEAR}`,
  })
  year: number;
}

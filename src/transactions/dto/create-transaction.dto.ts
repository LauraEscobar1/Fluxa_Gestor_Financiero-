import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CategoryType } from '../../categories/enums/category-type.enum';
import { IsDateOnly } from '../../common/dates';

/** Máximo que admite una columna `decimal(12,2)`. */
export const MAX_AMOUNT = 9_999_999_999.99;

/** Recorta la descripción; si queda vacía se guarda como `null`. */
const normalizeDescription = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/** Body de `POST /transactions`. */
export class CreateTransactionDto {
  @ApiProperty({
    example: 125000.5,
    description: 'Mayor que 0, con 2 decimales como máximo',
    maximum: MAX_AMOUNT,
  })
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: 'El monto debe ser un número con 2 decimales como máximo' },
  )
  @IsPositive({ message: 'El monto debe ser mayor que 0' })
  @Max(MAX_AMOUNT, { message: `El monto no puede superar ${MAX_AMOUNT}` })
  amount: number;

  @ApiProperty({ enum: CategoryType, example: CategoryType.EXPENSE })
  @IsEnum(CategoryType, {
    message: 'El tipo debe ser "income" o "expense"',
  })
  type: CategoryType;

  @ApiProperty({
    example: 3,
    description: 'Categoría propia del mismo tipo que la transacción',
  })
  @IsInt({ message: 'La categoría debe ser un id entero' })
  @Min(1, { message: 'La categoría debe ser un id válido' })
  categoryId: number;

  @ApiProperty({
    example: '2026-01-15',
    format: 'date',
    description: 'YYYY-MM-DD; como máximo un año en el futuro',
  })
  @IsDateOnly({
    message: 'La fecha debe ser válida y tener el formato YYYY-MM-DD',
  })
  date: string;

  @ApiPropertyOptional({
    example: 'Mercado de la semana',
    maxLength: 255,
    nullable: true,
    type: String,
  })
  @Transform(normalizeDescription)
  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto' })
  @MaxLength(255, {
    message: 'La descripción no puede superar los 255 caracteres',
  })
  description?: string | null;
}

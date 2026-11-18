import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_YEAR, MIN_YEAR } from '../../budgets/dto/create-budget.dto';
import { CategoryType } from '../../categories/enums/category-type.enum';

/** Query de `GET /summary/monthly`: año (por defecto, el actual en UTC). */
export class SummaryYearQueryDto {
  @ApiPropertyOptional({
    example: 2026,
    minimum: MIN_YEAR,
    maximum: MAX_YEAR,
    description: 'Por defecto, el año actual (UTC)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El año debe ser un número entero' })
  @Min(MIN_YEAR, {
    message: `El año debe estar entre ${MIN_YEAR} y ${MAX_YEAR}`,
  })
  @Max(MAX_YEAR, {
    message: `El año debe estar entre ${MIN_YEAR} y ${MAX_YEAR}`,
  })
  year?: number;
}

/** Query de `GET /summary`: mes y año (por defecto, los actuales en UTC). */
export class SummaryMonthQueryDto extends SummaryYearQueryDto {
  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    maximum: 12,
    description: 'Por defecto, el mes actual (UTC)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El mes debe ser un número entero' })
  @Min(1, { message: 'El mes debe estar entre 1 y 12' })
  @Max(12, { message: 'El mes debe estar entre 1 y 12' })
  month?: number;
}

/** Query de `GET /summary/by-category`: mes, año y tipo (por defecto `expense`). */
export class SummaryByCategoryQueryDto extends SummaryMonthQueryDto {
  @ApiPropertyOptional({
    enum: CategoryType,
    default: CategoryType.EXPENSE,
    description: 'Tipo de transacción a agrupar',
  })
  @IsOptional()
  @IsEnum(CategoryType, {
    message: 'El tipo debe ser "income" o "expense"',
  })
  type?: CategoryType;
}

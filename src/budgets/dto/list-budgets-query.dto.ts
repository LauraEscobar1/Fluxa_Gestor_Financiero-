import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_YEAR, MIN_YEAR } from './create-budget.dto';

/** Query de `GET /budgets`: mes y año (por defecto, los actuales en UTC). */
export class ListBudgetsQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El mes debe ser un número entero' })
  @Min(1, { message: 'El mes debe estar entre 1 y 12' })
  @Max(12, { message: 'El mes debe estar entre 1 y 12' })
  month?: number;

  @ApiPropertyOptional({ example: 2026, minimum: MIN_YEAR, maximum: MAX_YEAR })
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

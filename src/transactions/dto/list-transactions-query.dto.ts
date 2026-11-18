import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { CategoryType } from '../../categories/enums/category-type.enum';
import { IsDateOnly, IsOnOrAfterDate } from '../../common/dates';
import { PaginationQueryDto } from '../../common/pagination';

/** Query de `GET /transactions`: paginación y filtros opcionales. */
export class ListTransactionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CategoryType, description: 'Filtra por tipo' })
  @IsOptional()
  @IsEnum(CategoryType, {
    message: 'El tipo debe ser "income" o "expense"',
  })
  type?: CategoryType;

  @ApiPropertyOptional({ description: 'Filtra por categoría', example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'categoryId debe ser un número entero' })
  @Min(1, { message: 'categoryId debe ser como mínimo 1' })
  categoryId?: number;

  @ApiPropertyOptional({
    description: 'Fecha inicial incluida (YYYY-MM-DD)',
    example: '2026-01-01',
    format: 'date',
  })
  @IsOptional()
  @IsDateOnly({
    message: 'from debe ser una fecha válida con formato YYYY-MM-DD',
  })
  from?: string;

  @ApiPropertyOptional({
    description:
      'Fecha final incluida (YYYY-MM-DD); no puede ser anterior a from',
    example: '2026-01-31',
    format: 'date',
  })
  @IsOptional()
  @IsDateOnly({
    message: 'to debe ser una fecha válida con formato YYYY-MM-DD',
  })
  @IsOnOrAfterDate('from', {
    message: 'La fecha "from" no puede ser posterior a "to"',
  })
  to?: string;
}

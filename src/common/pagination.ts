import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Parámetros de paginación comunes para los listados (`?page=1&limit=20`). */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Número de página',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser como mínimo 1' })
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Elementos por página',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser como mínimo 1' })
  @Max(100, { message: 'limit debe ser como máximo 100' })
  limit: number = 20;
}

/** Respuesta estándar de los listados paginados. */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/** Construye la respuesta paginada a partir de los datos y el total. */
export function paginated<T>(
  data: T[],
  total: number,
  query: PaginationQueryDto,
): Paginated<T> {
  return { data, total, page: query.page, limit: query.limit };
}

/** Convierte la paginación a las opciones `skip`/`take` de TypeORM. */
export function pageOptions(query: PaginationQueryDto): {
  skip: number;
  take: number;
} {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}

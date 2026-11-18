import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CategoryType } from '../enums/category-type.enum';

/** Query de `GET /categories`. */
export class ListCategoriesQueryDto {
  @ApiPropertyOptional({
    enum: CategoryType,
    description: 'Filtra por tipo de categoría',
  })
  @IsOptional()
  @IsEnum(CategoryType, {
    message: 'El tipo debe ser "income" o "expense"',
  })
  type?: CategoryType;
}

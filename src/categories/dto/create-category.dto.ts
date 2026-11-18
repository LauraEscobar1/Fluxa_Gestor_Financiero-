import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trim } from '../../users/dto/create-user.dto';
import { CategoryType } from '../enums/category-type.enum';

/** Body de `POST /categories`. */
export class CreateCategoryDto {
  @ApiProperty({ example: 'Mascotas', maxLength: 100 })
  @Transform(trim)
  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres' })
  name: string;

  @ApiProperty({ enum: CategoryType, example: CategoryType.EXPENSE })
  @IsEnum(CategoryType, {
    message: 'El tipo debe ser "income" o "expense"',
  })
  type: CategoryType;
}

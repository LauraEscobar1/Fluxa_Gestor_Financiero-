import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  IsValidPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './is-valid-password.decorator';

/** Quita espacios al inicio y al final si el valor es texto. */
export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Normaliza el email: sin espacios y en minúsculas. */
export const normalizeEmailValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Datos para crear un usuario (los usa `POST /auth/register`). */
export class CreateUserDto {
  @ApiProperty({ example: 'Ana Pérez', maxLength: 100 })
  @Transform(trim)
  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres' })
  name: string;

  @ApiProperty({
    example: 'ana@example.com',
    description: 'Se guarda en minúsculas',
  })
  @Transform(normalizeEmailValue)
  @IsEmail({}, { message: 'El email no es válido' })
  @MaxLength(255, { message: 'El email no puede superar los 255 caracteres' })
  email: string;

  @ApiProperty({
    example: 'Secreta123',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    description: 'Al menos una letra y un número',
  })
  @IsValidPassword()
  password: string;
}

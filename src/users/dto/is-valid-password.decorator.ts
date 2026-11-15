import { applyDecorators } from '@nestjs/common';
import {
  IsByteLength,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Longitud mínima de una contraseña. */
export const PASSWORD_MIN_LENGTH = 8;

/** bcrypt ignora todo lo que pase de 72 bytes, así que es el máximo permitido. */
export const PASSWORD_MAX_LENGTH = 72;

/**
 * Reglas de una contraseña nueva: 8 a 72 caracteres (y no más de 72 bytes,
 * relevante con tildes o emojis) con al menos una letra y un número.
 */
export function IsValidPassword(): PropertyDecorator {
  return applyDecorators(
    IsString({ message: 'La contraseña debe ser un texto' }),
    MinLength(PASSWORD_MIN_LENGTH, {
      message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    }),
    MaxLength(PASSWORD_MAX_LENGTH, {
      message: `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres`,
    }),
    IsByteLength(0, PASSWORD_MAX_LENGTH, {
      message: `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} bytes`,
    }),
    Matches(/\p{L}/u, {
      message: 'La contraseña debe contener al menos una letra',
    }),
    Matches(/\d/, {
      message: 'La contraseña debe contener al menos un número',
    }),
  );
}

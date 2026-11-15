import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import {
  IsValidPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './is-valid-password.decorator';

/** Cambio de contraseña del usuario autenticado. */
export class ChangePasswordDto {
  @ApiProperty({ example: 'Secreta123' })
  @IsString({ message: 'La contraseña actual debe ser un texto' })
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria' })
  currentPassword: string;

  @ApiProperty({
    example: 'NuevaClave456',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    description: 'Al menos una letra y un número',
  })
  @IsValidPassword()
  newPassword: string;
}

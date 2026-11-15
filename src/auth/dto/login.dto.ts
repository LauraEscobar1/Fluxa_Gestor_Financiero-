import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { normalizeEmailValue } from '../../users/dto/create-user.dto';

/** Body de `POST /auth/login`. */
export class LoginDto {
  @ApiProperty({ example: 'ana@example.com' })
  @Transform(normalizeEmailValue)
  @IsEmail({}, { message: 'El email no es válido' })
  email: string;

  @ApiProperty({ example: 'Secreta123' })
  @IsString({ message: 'La contraseña debe ser un texto' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password: string;
}

import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

/**
 * Datos editables del perfil propio: nombre y/o email. La contraseña se
 * cambia por separado en `PATCH /users/me/password`.
 */
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {}

import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

/**
 * Datos editables del perfil propio: nombre y/o email. La contraseña se
 * cambia por separado en `PATCH /users/me/password`. `skipNullProperties:
 * false` hace que un `null` se valide y se rechace con 400 (antes llegaba al
 * servicio y `{"email": null}` terminaba en un 500).
 */
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
  { skipNullProperties: false },
) {}

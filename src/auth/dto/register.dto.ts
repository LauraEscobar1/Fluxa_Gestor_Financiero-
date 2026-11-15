import { CreateUserDto } from '../../users/dto/create-user.dto';

/** Body de `POST /auth/register`: `{ name, email, password }`. */
export class RegisterDto extends CreateUserDto {}

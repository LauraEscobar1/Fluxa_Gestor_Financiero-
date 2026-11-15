import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { verifyPassword } from '../common/password';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

/** Mensaje único para cualquier fallo de login: no revela si el email existe. */
export const INVALID_CREDENTIALS_MESSAGE = 'Credenciales inválidas';

/**
 * Hash bcrypt (mismo coste que `BCRYPT_ROUNDS`) de un valor aleatorio. Se
 * compara contra él cuando el email no existe para que la respuesta tarde lo
 * mismo que con una contraseña incorrecta.
 */
const DUMMY_PASSWORD_HASH =
  '$2b$12$AzuHDbsu2VmoNeoG5AkDQOXkPn5wFisMWhDOzAya7Bg2jJieUSWKK';

/** Registro, login y emisión de tokens. */
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly categoriesService: CategoriesService,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Crea la cuenta con sus categorías por defecto y devuelve un token para no
   * tener que hacer login después. Usuario y categorías se guardan en una
   * misma transacción: si algo falla, no queda una cuenta a medias.
   * @throws ConflictException si el email ya está registrado.
   */
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const user = await this.dataSource.transaction(async (manager) => {
      const created = await this.usersService.create(dto, manager);
      await this.categoriesService.createDefaultsForUser(created.id, manager);
      return created;
    });
    return this.buildAuthResponse(user);
  }

  /**
   * Verifica las credenciales y devuelve un token.
   * @throws UnauthorizedException con el mismo mensaje si el email no existe o la contraseña no coincide.
   */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(dto.email, {
      withPassword: true,
    });
    const passwordMatches = await verifyPassword(
      dto.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const { passwordHash: _omit, ...safeUser } = user;
    return this.buildAuthResponse(safeUser as User);
  }

  private async buildAuthResponse(user: User): Promise<AuthResponseDto> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      user,
    };
  }
}

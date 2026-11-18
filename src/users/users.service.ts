import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { hashPassword, verifyPassword } from '../common/password';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

/** Opciones de `findByEmail`. */
export interface FindByEmailOptions {
  /** Incluye `passwordHash` (columna con `select: false`). Solo para login. */
  withPassword?: boolean;
}

/** Los emails se guardan y se buscan siempre sin espacios y en minúsculas. */
const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** Gestión de usuarios. Ningún método devuelve `passwordHash` salvo `findByEmail` con `withPassword`. */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Crea un usuario guardando el hash de su contraseña.
   * Recibe opcionalmente un `EntityManager` para ejecutarse dentro de una
   * transacción (p. ej. la del registro).
   * @throws ConflictException si el email ya está registrado.
   */
  async create(dto: CreateUserDto, manager?: EntityManager): Promise<User> {
    const repository = manager
      ? manager.getRepository(User)
      : this.usersRepository;
    const email = normalizeEmail(dto.email);
    await this.assertEmailAvailable(email, repository);

    const saved = await repository.save(
      repository.create({
        name: dto.name,
        email,
        passwordHash: await hashPassword(dto.password),
      }),
    );
    const { passwordHash: _omit, ...user } = saved;
    return user as User;
  }

  /**
   * Busca un usuario por email (sin distinguir mayúsculas).
   * Con `withPassword: true` incluye el hash para verificar credenciales.
   */
  findByEmail(
    email: string,
    options: FindByEmailOptions = {},
  ): Promise<User | null> {
    const query = this.usersRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email: normalizeEmail(email) });
    if (options.withPassword) {
      query.addSelect('user.passwordHash');
    }
    return query.getOne();
  }

  /**
   * Obtiene un usuario por id.
   * @throws NotFoundException si no existe.
   */
  async findById(id: number): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  /**
   * Actualiza nombre y/o email.
   * @throws NotFoundException si el usuario no existe.
   * @throws ConflictException si el nuevo email ya pertenece a otro usuario.
   */
  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    if (dto.email !== undefined) {
      const email = normalizeEmail(dto.email);
      if (email !== user.email) {
        await this.assertEmailAvailable(email);
      }
      user.email = email;
    }
    if (dto.name !== undefined) {
      user.name = dto.name;
    }

    return this.usersRepository.save(user);
  }

  /**
   * Cambia la contraseña tras comprobar la actual.
   * @throws NotFoundException si el usuario no existe.
   * @throws BadRequestException si la contraseña actual no coincide.
   */
  async changePassword(
    id: number,
    dto: ChangePasswordDto,
  ): Promise<MessageResponseDto> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const matches = await verifyPassword(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!matches) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    await this.usersRepository.update(id, {
      passwordHash: await hashPassword(dto.newPassword),
    });
    return { message: 'Contraseña actualizada correctamente' };
  }

  /**
   * Elimina la cuenta; sus recursos se borran en cascada (`onDelete: 'CASCADE'`).
   * @throws NotFoundException si el usuario no existe.
   */
  async remove(id: number): Promise<MessageResponseDto> {
    const { affected } = await this.usersRepository.delete(id);
    if (!affected) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return { message: 'Cuenta eliminada correctamente' };
  }

  /** @throws ConflictException si el email (ya normalizado) está en uso. */
  private async assertEmailAvailable(
    email: string,
    repository: Repository<User> = this.usersRepository,
  ): Promise<void> {
    if (await repository.existsBy({ email })) {
      throw new ConflictException('El email ya está registrado');
    }
  }
}

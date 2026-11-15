import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { DEFAULT_CATEGORIES } from './default-categories';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';
import { CategoryType } from './enums/category-type.enum';

/** Código SQLSTATE de Postgres para violación de clave foránea. */
const FOREIGN_KEY_VIOLATION = '23503';

/**
 * Categorías del usuario. Todos los métodos reciben `userId` y filtran por
 * él: una categoría de otro usuario se trata como inexistente (404).
 */
@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  /** Lista las categorías del usuario por nombre, con filtro opcional por tipo. */
  findAll(userId: number, type?: CategoryType): Promise<Category[]> {
    return this.categoriesRepository.find({
      where: { userId, ...(type && { type }) },
      order: { name: 'ASC' },
    });
  }

  /**
   * Obtiene una categoría del usuario.
   * @throws NotFoundException si no existe o es de otro usuario.
   */
  async findOne(userId: number, id: number): Promise<Category> {
    const category = await this.categoriesRepository.findOneBy({ id, userId });
    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }
    return category;
  }

  /**
   * Crea una categoría.
   * @throws ConflictException si el usuario ya tiene una con ese nombre y tipo.
   */
  async create(userId: number, dto: CreateCategoryDto): Promise<Category> {
    await this.assertNameAvailable(userId, dto.type, dto.name);
    return this.categoriesRepository.save(
      this.categoriesRepository.create({
        userId,
        name: dto.name,
        type: dto.type,
      }),
    );
  }

  /**
   * Cambia el nombre (el tipo no se puede modificar).
   * @throws NotFoundException si no existe o es de otro usuario.
   * @throws ConflictException si el nombre ya existe para ese tipo.
   */
  async update(
    userId: number,
    id: number,
    dto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findOne(userId, id);
    if (dto.name !== category.name) {
      await this.assertNameAvailable(userId, category.type, dto.name);
      category.name = dto.name;
    }
    return this.categoriesRepository.save(category);
  }

  /**
   * Elimina una categoría.
   * @throws NotFoundException si no existe o es de otro usuario.
   * @throws ConflictException si tiene transacciones asociadas (FK RESTRICT).
   */
  async remove(userId: number, id: number): Promise<MessageResponseDto> {
    let affected: number | null | undefined;
    try {
      ({ affected } = await this.categoriesRepository.delete({ id, userId }));
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string } | undefined)?.code ===
          FOREIGN_KEY_VIOLATION
      ) {
        throw new ConflictException(
          'La categoría tiene transacciones asociadas',
        );
      }
      throw error;
    }
    if (!affected) {
      throw new NotFoundException('Categoría no encontrada');
    }
    return { message: 'Categoría eliminada correctamente' };
  }

  /**
   * Crea las categorías por defecto del usuario en una sola inserción en lote
   * ignorando duplicados (`ON CONFLICT DO NOTHING`), por lo que es idempotente.
   * Recibe opcionalmente un `EntityManager` para ejecutarse dentro de una
   * transacción (p. ej. la del registro).
   */
  async createDefaultsForUser(
    userId: number,
    manager?: EntityManager,
  ): Promise<void> {
    const repository = manager
      ? manager.getRepository(Category)
      : this.categoriesRepository;
    await repository
      .createQueryBuilder()
      .insert()
      .into(Category)
      .values(DEFAULT_CATEGORIES.map((category) => ({ ...category, userId })))
      .orIgnore()
      .execute();
  }

  /** @throws ConflictException si ya existe (userId, type, name). */
  private async assertNameAvailable(
    userId: number,
    type: CategoryType,
    name: string,
  ): Promise<void> {
    if (await this.categoriesRepository.existsBy({ userId, type, name })) {
      throw new ConflictException(
        'Ya existe una categoría con ese nombre y tipo',
      );
    }
  }
}

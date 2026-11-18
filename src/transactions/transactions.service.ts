import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { CategoryType } from '../categories/enums/category-type.enum';
import { addYears, toDateOnly } from '../common/dates';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { Paginated, pageOptions, paginated } from '../common/pagination';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { Transaction } from './entities/transaction.entity';

/** Años hacia el futuro que se permiten en la fecha de una transacción. */
const MAX_YEARS_AHEAD = 1;

/**
 * Transacciones (ingresos y gastos) del usuario. Todos los métodos reciben
 * `userId` y filtran por él: una transacción de otro usuario se trata como
 * inexistente (404). Las respuestas incluyen la categoría (id, name, type).
 */
@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
    private readonly categoriesService: CategoriesService,
  ) {}

  /**
   * Lista paginada de las transacciones del usuario, de la más reciente a la
   * más antigua (`date DESC, id DESC`), con filtros opcionales por tipo,
   * categoría y rango de fechas inclusivo.
   */
  async findAll(
    userId: number,
    query: ListTransactionsQueryDto,
  ): Promise<Paginated<Transaction>> {
    const qb = this.withCategory(userId);
    if (query.type) {
      qb.andWhere('transaction.type = :type', { type: query.type });
    }
    if (query.categoryId) {
      qb.andWhere('transaction.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.from) {
      qb.andWhere('transaction.date >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('transaction.date <= :to', { to: query.to });
    }

    // `offset`/`limit` (en vez de `skip`/`take`) son seguros aquí porque el
    // join es ManyToOne y no duplica filas; así se evita la subconsulta extra.
    const { skip, take } = pageOptions(query);
    const [data, total] = await qb
      .orderBy('transaction.date', 'DESC')
      .addOrderBy('transaction.id', 'DESC')
      .offset(skip)
      .limit(take)
      .getManyAndCount();
    return paginated(data, total, query);
  }

  /**
   * Obtiene una transacción del usuario con su categoría.
   * @throws NotFoundException si no existe o es de otro usuario.
   */
  async findOne(userId: number, id: number): Promise<Transaction> {
    const transaction = await this.withCategory(userId)
      .andWhere('transaction.id = :id', { id })
      .getOne();
    if (!transaction) {
      throw new NotFoundException('Transacción no encontrada');
    }
    return transaction;
  }

  /**
   * Registra una transacción.
   * @throws NotFoundException si la categoría no existe o es de otro usuario.
   * @throws BadRequestException si el tipo no coincide con el de la categoría
   * o la fecha supera el máximo permitido.
   */
  async create(
    userId: number,
    dto: CreateTransactionDto,
  ): Promise<Transaction> {
    this.assertDateAllowed(dto.date);
    await this.assertCategoryMatches(userId, dto.categoryId, dto.type);
    const saved = await this.transactionsRepository.save(
      this.transactionsRepository.create({
        userId,
        amount: dto.amount,
        type: dto.type,
        categoryId: dto.categoryId,
        date: dto.date,
        description: dto.description ?? null,
      }),
    );
    return this.findOne(userId, saved.id);
  }

  /**
   * Actualización parcial. Si cambia `type` o `categoryId` se vuelve a
   * comprobar la coherencia con los valores resultantes.
   * @throws NotFoundException si la transacción o la categoría no existen o
   * son de otro usuario.
   * @throws BadRequestException si el tipo resultante no coincide con el de la
   * categoría o la fecha supera el máximo permitido.
   */
  async update(
    userId: number,
    id: number,
    dto: UpdateTransactionDto,
  ): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOneBy({
      id,
      userId,
    });
    if (!transaction) {
      throw new NotFoundException('Transacción no encontrada');
    }
    if (dto.date !== undefined) {
      this.assertDateAllowed(dto.date);
    }
    if (dto.type !== undefined || dto.categoryId !== undefined) {
      await this.assertCategoryMatches(
        userId,
        dto.categoryId ?? transaction.categoryId,
        dto.type ?? transaction.type,
      );
    }

    this.transactionsRepository.merge(transaction, {
      ...(dto.amount !== undefined && { amount: dto.amount }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      ...(dto.date !== undefined && { date: dto.date }),
      ...(dto.description !== undefined && { description: dto.description }),
    });
    await this.transactionsRepository.save(transaction);
    return this.findOne(userId, id);
  }

  /**
   * Elimina una transacción.
   * @throws NotFoundException si no existe o es de otro usuario.
   */
  async remove(userId: number, id: number): Promise<MessageResponseDto> {
    const { affected } = await this.transactionsRepository.delete({
      id,
      userId,
    });
    if (!affected) {
      throw new NotFoundException('Transacción no encontrada');
    }
    return { message: 'Transacción eliminada correctamente' };
  }

  /** Consulta base: transacciones del usuario con id, nombre y tipo de su categoría. */
  private withCategory(userId: number): SelectQueryBuilder<Transaction> {
    return this.transactionsRepository
      .createQueryBuilder('transaction')
      .innerJoin('transaction.category', 'category')
      .addSelect(['category.id', 'category.name', 'category.type'])
      .where('transaction.userId = :userId', { userId });
  }

  /**
   * @throws NotFoundException si la categoría no existe o es de otro usuario.
   * @throws BadRequestException si su tipo no coincide con `type`.
   */
  private async assertCategoryMatches(
    userId: number,
    categoryId: number,
    type: CategoryType,
  ): Promise<void> {
    const category = await this.categoriesService.findOne(userId, categoryId);
    if (category.type !== type) {
      throw new BadRequestException(
        `El tipo de la transacción (${type}) no coincide con el de la categoría (${category.type})`,
      );
    }
  }

  /** @throws BadRequestException si `date` es posterior a hoy + 1 año (UTC). */
  private assertDateAllowed(date: string): void {
    const maxDate = addYears(toDateOnly(new Date()), MAX_YEARS_AHEAD);
    if (date > maxDate) {
      throw new BadRequestException(
        `La fecha no puede ser posterior a ${maxDate} (un año desde hoy)`,
      );
    }
  }
}

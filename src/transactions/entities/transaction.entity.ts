import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { CategoryType } from '../../categories/enums/category-type.enum';
import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { User } from '../../users/entities/user.entity';
import { TransactionCategoryDto } from '../dto/transaction-category.dto';

/**
 * Ingreso o gasto de un usuario. Su tipo siempre coincide con el de su
 * categoría (lo garantiza `TransactionsService`).
 */
@Entity('transactions')
@Index('IDX_transactions_user_date', ['userId', 'date'])
@Index('IDX_transactions_category', ['categoryId'])
export class Transaction {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 125000.5, description: 'Mayor que 0, 2 decimales' })
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount: number;

  /** Reutiliza el enum de Postgres `category_type` de las categorías. */
  @ApiProperty({ enum: CategoryType, example: CategoryType.EXPENSE })
  @Column({ type: 'enum', enum: CategoryType, enumName: 'category_type' })
  type: CategoryType;

  @ApiProperty({
    example: 'Mercado de la semana',
    maxLength: 255,
    nullable: true,
    type: String,
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  /** Fecha de calendario sin hora; se lee y escribe como `YYYY-MM-DD`. */
  @ApiProperty({ example: '2026-01-15', format: 'date' })
  @Column({ type: 'date' })
  date: string;

  @ApiProperty({ example: 3 })
  @Column({ name: 'category_id', type: 'int' })
  categoryId: number;

  /** No se puede borrar una categoría que tenga transacciones. */
  @ApiProperty({ type: () => TransactionCategoryDto })
  @ManyToOne(() => Category, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'category_id' })
  category?: TransactionCategoryDto;

  @ApiProperty({ example: 1 })
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  /** Dueño de la transacción; al borrar el usuario se borran sus transacciones. */
  @ApiHideProperty()
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}

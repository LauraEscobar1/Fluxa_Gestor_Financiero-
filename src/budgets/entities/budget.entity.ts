import { ApiHideProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { User } from '../../users/entities/user.entity';

/**
 * Límite mensual de gasto de un usuario para una categoría de gastos. Solo
 * guarda el límite: lo gastado se calcula con las transacciones.
 */
@Entity('budgets')
@Unique('UQ_budgets_user_category_month_year', [
  'userId',
  'categoryId',
  'month',
  'year',
])
export class Budget {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'category_id', type: 'int' })
  categoryId: number;

  /** Al borrar la categoría se borran sus presupuestos. */
  @ApiHideProperty()
  @ManyToOne(() => Category, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'category_id' })
  category?: Pick<Category, 'id' | 'name'>;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount: number;

  @Column({ type: 'smallint' })
  month: number;

  @Column({ type: 'int' })
  year: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  /** Dueño del presupuesto; al borrar el usuario se borran sus presupuestos. */
  @ApiHideProperty()
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}

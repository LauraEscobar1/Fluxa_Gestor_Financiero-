import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { User } from '../../users/entities/user.entity';

/**
 * Meta de ahorro de un usuario. Guarda el objetivo y el saldo acumulado; el
 * estado, el progreso y lo que falta se calculan en cada respuesta.
 *
 * `currentAmount` solo cambia con depósitos y retiros
 * (`SavingsGoalsService.deposit` / `withdraw`), que lo actualizan de forma
 * atómica. La restricción CHECK es una red de seguridad: el retiro ya
 * comprueba el saldo dentro del propio UPDATE.
 */
@Entity('savings_goals')
@Index('IDX_savings_goals_user', ['userId'])
@Check('CHK_savings_goals_current_amount_non_negative', '"current_amount" >= 0')
export class SavingsGoal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({
    name: 'target_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  targetAmount: number;

  @Column({
    name: 'current_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  currentAmount: number;

  /** Fecha límite opcional sin hora; se lee y escribe como `YYYY-MM-DD`. */
  @Column({ name: 'target_date', type: 'date', nullable: true })
  targetDate: string | null;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  /** Dueño de la meta; al borrar el usuario se borran sus metas. */
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

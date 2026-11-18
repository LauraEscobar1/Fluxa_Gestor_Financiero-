import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { SavingsGoalMovementType } from '../enums/savings-goal-movement-type.enum';
import { SavingsGoal } from './savings-goal.entity';

/**
 * Depósito o retiro de una meta de ahorro. Es un historial inmutable: se
 * crea en la misma transacción que actualiza el saldo y nunca se edita. La
 * pertenencia al usuario se obtiene a través de la meta.
 */
@Entity('savings_goal_movements')
@Index('IDX_savings_goal_movements_goal_created', ['goalId', 'createdAt'])
export class SavingsGoalMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'goal_id', type: 'int' })
  goalId: number;

  /** Al borrar la meta se borra su historial. */
  @ManyToOne(() => SavingsGoal, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'goal_id' })
  goal?: SavingsGoal;

  /** Siempre positivo; el signo lo da `type`. */
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount: number;

  @Column({
    type: 'enum',
    enum: SavingsGoalMovementType,
    enumName: 'savings_goal_movement_type',
  })
  type: SavingsGoalMovementType;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}

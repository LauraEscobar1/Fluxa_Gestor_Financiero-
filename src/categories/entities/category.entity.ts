import { ApiProperty } from '@nestjs/swagger';
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
import { User } from '../../users/entities/user.entity';
import { CategoryType } from '../enums/category-type.enum';

/**
 * Categoría de ingresos o gastos propia de un usuario. No puede haber dos
 * categorías con el mismo nombre y tipo para el mismo usuario.
 */
@Entity('categories')
@Unique('UQ_categories_user_type_name', ['userId', 'type', 'name'])
export class Category {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Alimentación', maxLength: 100 })
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @ApiProperty({ enum: CategoryType, example: CategoryType.EXPENSE })
  @Column({ type: 'enum', enum: CategoryType, enumName: 'category_type' })
  type: CategoryType;

  @ApiProperty({ example: 1 })
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  /** Dueño de la categoría; al borrar el usuario se borran sus categorías. */
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

import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Usuario de Fluxa. Es el dueño de todos los demás recursos (categorías,
 * transacciones, presupuestos y metas de ahorro).
 */
@Entity('users')
export class User {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Ana Pérez', maxLength: 100 })
  @Column({ type: 'varchar', length: 100 })
  name: string;

  /** Único y siempre en minúsculas (lo normaliza `UsersService`). */
  @ApiProperty({ example: 'ana@example.com' })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  /**
   * Hash bcrypt de la contraseña. `select: false` evita que se cargue en las
   * consultas normales; solo se obtiene con `addSelect` de forma explícita.
   */
  @ApiHideProperty()
  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
  passwordHash: string;

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

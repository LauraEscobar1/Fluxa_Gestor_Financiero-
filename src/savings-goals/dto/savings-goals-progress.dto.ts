import { ApiProperty } from '@nestjs/swagger';

/** Progreso agregado de todas las metas de ahorro de un usuario. */
export class SavingsGoalsProgressDto {
  @ApiProperty({
    example: 3800000,
    description: 'Suma de currentAmount de todas las metas',
  })
  totalSaved: number;

  @ApiProperty({
    example: 6500000,
    description: 'Suma de targetAmount de todas las metas',
  })
  totalTarget: number;

  @ApiProperty({
    example: 1,
    description: 'Metas con currentAmount < targetAmount',
  })
  active: number;

  @ApiProperty({
    example: 1,
    description: 'Metas con currentAmount >= targetAmount',
  })
  completed: number;
}

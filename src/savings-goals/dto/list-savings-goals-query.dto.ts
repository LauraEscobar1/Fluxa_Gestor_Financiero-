import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';
import { SavingsGoalStatus } from '../enums/savings-goal-status.enum';

/** Query de `GET /savings-goals`: paginación y filtro opcional por estado. */
export class ListSavingsGoalsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: SavingsGoalStatus,
    description: 'Filtra por estado calculado',
  })
  @IsOptional()
  @IsEnum(SavingsGoalStatus, {
    message: 'El estado debe ser "active" o "completed"',
  })
  status?: SavingsGoalStatus;
}

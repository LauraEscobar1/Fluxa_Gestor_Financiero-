import { ApiProperty } from '@nestjs/swagger';
import type { Paginated } from '../../common/pagination';
import { Transaction } from '../entities/transaction.entity';

/** Respuesta de `GET /transactions` (solo para documentar en Swagger). */
export class PaginatedTransactionsDto implements Paginated<Transaction> {
  @ApiProperty({ type: [Transaction] })
  data: Transaction[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}

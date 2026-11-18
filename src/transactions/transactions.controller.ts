import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import type { Paginated } from '../common/pagination';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { PaginatedTransactionsDto } from './dto/paginated-transactions.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { Transaction } from './entities/transaction.entity';
import { TransactionsService } from './transactions.service';

/** Ingresos y gastos del usuario autenticado. */
@ApiTags('transactions')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Token ausente, inválido o expirado' })
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lista paginada de transacciones propias (date DESC, id DESC)',
  })
  @ApiResponse({
    status: 200,
    description: 'Página de transacciones',
    type: PaginatedTransactionsDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Filtros o paginación inválidos (p. ej. from > to)',
  })
  findAll(
    @CurrentUser('id') userId: number,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<Paginated<Transaction>> {
    return this.transactionsService.findAll(userId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtiene una transacción propia' })
  @ApiResponse({ status: 200, description: 'Transacción', type: Transaction })
  @ApiResponse({ status: 400, description: 'Id inválido' })
  @ApiResponse({ status: 404, description: 'Transacción no encontrada' })
  findOne(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Transaction> {
    return this.transactionsService.findOne(userId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registra un ingreso o un gasto' })
  @ApiResponse({
    status: 201,
    description: 'Transacción creada',
    type: Transaction,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos, tipo distinto al de la categoría o fecha a más de un año',
  })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  create(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateTransactionDto,
  ): Promise<Transaction> {
    return this.transactionsService.create(userId, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualiza parcialmente una transacción' })
  @ApiResponse({
    status: 200,
    description: 'Transacción actualizada',
    type: Transaction,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos, tipo distinto al de la categoría o fecha a más de un año',
  })
  @ApiResponse({
    status: 404,
    description: 'Transacción o categoría no encontrada',
  })
  update(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionDto,
  ): Promise<Transaction> {
    return this.transactionsService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Elimina una transacción' })
  @ApiResponse({
    status: 200,
    description: 'Transacción eliminada',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Id inválido' })
  @ApiResponse({ status: 404, description: 'Transacción no encontrada' })
  remove(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<MessageResponseDto> {
    return this.transactionsService.remove(userId, id);
  }
}

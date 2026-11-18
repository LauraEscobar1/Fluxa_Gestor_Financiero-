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
import { BudgetsService } from './budgets.service';
import { BudgetResponseDto } from './dto/budget-response.dto';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { ListBudgetsQueryDto } from './dto/list-budgets-query.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

/** Presupuestos mensuales por categoría del usuario autenticado. */
@ApiTags('budgets')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Token ausente, inválido o expirado' })
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Presupuestos de un mes (por defecto el actual) con lo gastado, ordenados por categoría',
  })
  @ApiResponse({
    status: 200,
    description: 'Presupuestos con spent, remaining, percentUsed y status',
    type: [BudgetResponseDto],
  })
  @ApiResponse({ status: 400, description: 'Mes o año inválidos' })
  findAll(
    @CurrentUser('id') userId: number,
    @Query() query: ListBudgetsQueryDto,
  ): Promise<BudgetResponseDto[]> {
    return this.budgetsService.findAll(userId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtiene un presupuesto propio con lo gastado' })
  @ApiResponse({
    status: 200,
    description: 'Presupuesto',
    type: BudgetResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Id inválido' })
  @ApiResponse({ status: 404, description: 'Presupuesto no encontrado' })
  findOne(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<BudgetResponseDto> {
    return this.budgetsService.findOne(userId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crea el presupuesto de una categoría de gastos' })
  @ApiResponse({
    status: 201,
    description: 'Presupuesto creado',
    type: BudgetResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o la categoría no es de gastos',
  })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un presupuesto para esa categoría en ese mes',
  })
  create(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateBudgetDto,
  ): Promise<BudgetResponseDto> {
    return this.budgetsService.create(userId, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambia el monto de un presupuesto' })
  @ApiResponse({
    status: 200,
    description: 'Presupuesto actualizado',
    type: BudgetResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Presupuesto no encontrado' })
  update(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBudgetDto,
  ): Promise<BudgetResponseDto> {
    return this.budgetsService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Elimina un presupuesto' })
  @ApiResponse({
    status: 200,
    description: 'Presupuesto eliminado',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Id inválido' })
  @ApiResponse({ status: 404, description: 'Presupuesto no encontrado' })
  remove(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<MessageResponseDto> {
    return this.budgetsService.remove(userId, id);
  }
}

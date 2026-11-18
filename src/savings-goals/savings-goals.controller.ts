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
import { PaginationQueryDto } from '../common/pagination';
import type { Paginated } from '../common/pagination';
import { CreateMovementDto } from './dto/create-movement.dto';
import { CreateSavingsGoalDto } from './dto/create-savings-goal.dto';
import { ListSavingsGoalsQueryDto } from './dto/list-savings-goals-query.dto';
import {
  PaginatedSavingsGoalMovementsDto,
  PaginatedSavingsGoalsDto,
  SavingsGoalMovementResponseDto,
  SavingsGoalMovementResultDto,
  SavingsGoalResponseDto,
} from './dto/savings-goal-response.dto';
import { UpdateSavingsGoalDto } from './dto/update-savings-goal.dto';
import { SavingsGoalsService } from './savings-goals.service';

/** Metas de ahorro del usuario autenticado, con depósitos, retiros e historial. */
@ApiTags('savings-goals')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Token ausente, inválido o expirado' })
@Controller('savings-goals')
export class SavingsGoalsController {
  constructor(private readonly savingsGoalsService: SavingsGoalsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Lista paginada de metas (más recientes primero), con filtro opcional por estado',
  })
  @ApiResponse({
    status: 200,
    description: 'Metas con status, progressPercent y remaining',
    type: PaginatedSavingsGoalsDto,
  })
  @ApiResponse({ status: 400, description: 'Paginación o estado inválidos' })
  findAll(
    @CurrentUser('id') userId: number,
    @Query() query: ListSavingsGoalsQueryDto,
  ): Promise<Paginated<SavingsGoalResponseDto>> {
    return this.savingsGoalsService.findAll(userId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtiene una meta propia' })
  @ApiResponse({
    status: 200,
    description: 'Meta de ahorro',
    type: SavingsGoalResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Id inválido' })
  @ApiResponse({ status: 404, description: 'Meta no encontrada' })
  findOne(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SavingsGoalResponseDto> {
    return this.savingsGoalsService.findOne(userId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crea una meta de ahorro con saldo 0' })
  @ApiResponse({
    status: 201,
    description: 'Meta creada',
    type: SavingsGoalResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o fecha objetivo en el pasado',
  })
  create(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateSavingsGoalDto,
  ): Promise<SavingsGoalResponseDto> {
    return this.savingsGoalsService.create(userId, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Cambia nombre, monto objetivo o fecha límite (el saldo solo cambia con depósitos y retiros)',
  })
  @ApiResponse({
    status: 200,
    description: 'Meta actualizada',
    type: SavingsGoalResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o fecha objetivo en el pasado',
  })
  @ApiResponse({ status: 404, description: 'Meta no encontrada' })
  update(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSavingsGoalDto,
  ): Promise<SavingsGoalResponseDto> {
    return this.savingsGoalsService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Elimina una meta y su historial' })
  @ApiResponse({
    status: 200,
    description: 'Meta eliminada',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Id inválido' })
  @ApiResponse({ status: 404, description: 'Meta no encontrada' })
  remove(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<MessageResponseDto> {
    return this.savingsGoalsService.remove(userId, id);
  }

  @Post(':id/deposits')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Deposita en una meta y registra el movimiento' })
  @ApiResponse({
    status: 201,
    description: 'Movimiento registrado y meta actualizada',
    type: SavingsGoalMovementResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Monto inválido o saldo máximo superado',
  })
  @ApiResponse({ status: 404, description: 'Meta no encontrada' })
  deposit(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateMovementDto,
  ): Promise<SavingsGoalMovementResultDto> {
    return this.savingsGoalsService.deposit(userId, id, dto);
  }

  @Post(':id/withdrawals')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Retira de una meta y registra el movimiento' })
  @ApiResponse({
    status: 201,
    description: 'Movimiento registrado y meta actualizada',
    type: SavingsGoalMovementResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Monto inválido o fondos insuficientes en la meta',
  })
  @ApiResponse({ status: 404, description: 'Meta no encontrada' })
  withdraw(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateMovementDto,
  ): Promise<SavingsGoalMovementResultDto> {
    return this.savingsGoalsService.withdraw(userId, id, dto);
  }

  @Get(':id/movements')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Historial paginado de movimientos (más reciente primero)',
  })
  @ApiResponse({
    status: 200,
    description: 'Movimientos de la meta',
    type: PaginatedSavingsGoalMovementsDto,
  })
  @ApiResponse({ status: 400, description: 'Id o paginación inválidos' })
  @ApiResponse({ status: 404, description: 'Meta no encontrada' })
  findMovements(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<SavingsGoalMovementResponseDto>> {
    return this.savingsGoalsService.findMovements(userId, id, query);
  }
}

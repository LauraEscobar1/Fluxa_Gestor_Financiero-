import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  SummaryByCategoryQueryDto,
  SummaryMonthQueryDto,
  SummaryYearQueryDto,
} from './dto/summary-query.dto';
import {
  MonthlySummaryResponseDto,
  SummaryByCategoryResponseDto,
  SummaryResponseDto,
} from './dto/summary-response.dto';
import { FinancialSummaryService } from './financial-summary.service';

/** Resumen financiero (solo lectura) del usuario autenticado para el dashboard. */
@ApiTags('summary')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Token ausente, inválido o expirado' })
@Controller('summary')
export class FinancialSummaryController {
  constructor(private readonly summaryService: FinancialSummaryService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Resumen de un mes (por defecto el actual): ingresos, gastos, balance, tasa de ahorro, presupuestos por estado y progreso de metas',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen del mes',
    type: SummaryResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Mes o año inválidos' })
  getSummary(
    @CurrentUser('id') userId: number,
    @Query() query: SummaryMonthQueryDto,
  ): Promise<SummaryResponseDto> {
    return this.summaryService.getSummary(userId, query);
  }

  @Get('by-category')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Total y porcentaje por categoría de un mes, de mayor a menor (por defecto gastos)',
  })
  @ApiResponse({
    status: 200,
    description: 'Totales por categoría',
    type: SummaryByCategoryResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Mes, año o tipo inválidos' })
  getByCategory(
    @CurrentUser('id') userId: number,
    @Query() query: SummaryByCategoryQueryDto,
  ): Promise<SummaryByCategoryResponseDto> {
    return this.summaryService.getByCategory(userId, query);
  }

  @Get('monthly')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Ingresos, gastos y balance de los 12 meses de un año (por defecto el actual)',
  })
  @ApiResponse({
    status: 200,
    description: 'Evolución mensual del año',
    type: MonthlySummaryResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Año inválido' })
  getMonthly(
    @CurrentUser('id') userId: number,
    @Query() query: SummaryYearQueryDto,
  ): Promise<MonthlySummaryResponseDto> {
    return this.summaryService.getMonthly(userId, query);
  }
}

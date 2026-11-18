import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Public } from '../auth/decorators/public.decorator';

/** Respuesta de `GET /health`. */
export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status: 'ok';
}

/** Comprobación de salud para balanceadores y orquestadores. */
@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Estado de la API y de la conexión a la base de datos',
  })
  @ApiResponse({
    status: 200,
    description: 'API y base de datos disponibles',
    type: HealthResponseDto,
  })
  @ApiResponse({ status: 503, description: 'La base de datos no responde' })
  async check(): Promise<HealthResponseDto> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch (error) {
      this.logger.error(
        'Fallo la comprobación de la base de datos',
        error instanceof Error ? error.stack : String(error),
      );
      // No se expone el detalle del error de la base de datos.
      throw new ServiceUnavailableException('Base de datos no disponible');
    }
    return { status: 'ok' };
  }
}

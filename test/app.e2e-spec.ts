import {
  Controller,
  Get,
  INestApplication,
  NotFoundException,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PaginationQueryDto, paginated } from '../src/common/pagination';

@Controller('demo')
class DemoController {
  @Get()
  list(@Query() query: PaginationQueryDto) {
    return paginated([], 0, query);
  }

  @Get('missing')
  missing() {
    throw new NotFoundException('Recurso no encontrado');
  }

  @Get('boom')
  boom() {
    throw new Error('detalle interno');
  }
}

/**
 * E2E de la infraestructura común (ValidationPipe + filtro de excepciones)
 * sin base de datos.
 */
describe('Infraestructura común (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DemoController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /demo aplica valores por defecto de paginación', async () => {
    const res = await request(app.getHttpServer()).get('/demo').expect(200);
    expect(res.body).toEqual({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('GET /demo?limit=500 devuelve 400 con message array', async () => {
    const res = await request(app.getHttpServer())
      .get('/demo?limit=500')
      .expect(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      path: '/demo?limit=500',
    });
    expect(Array.isArray(res.body.message)).toBe(true);
  });

  it('rechaza propiedades no permitidas', async () => {
    await request(app.getHttpServer()).get('/demo?otra=1').expect(400);
  });

  it('404 con formato unificado', async () => {
    const res = await request(app.getHttpServer())
      .get('/demo/missing')
      .expect(404);
    expect(res.body.message).toBe('Recurso no encontrado');
  });

  it('500 sin filtrar detalles internos', async () => {
    const res = await request(app.getHttpServer())
      .get('/demo/boom')
      .expect(500);
    expect(res.body.message).toBe('Error interno del servidor');
    expect(JSON.stringify(res.body)).not.toContain('detalle interno');
  });
});

import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { HealthController } from '../src/health/health.controller';
import { UsersService } from '../src/users/users.service';

const dataSource = { query: jest.fn() };

/** `GET /health` con el guard JWT global real: debe ser público. */
describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-e2e' })],
      controllers: [HealthController],
      providers: [
        { provide: DataSource, useValue: dataSource },
        { provide: UsersService, useValue: { findById: jest.fn() } },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>({
      logger: false,
    });
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it('responde { status: "ok" } sin token y consulta SELECT 1', async () => {
    dataSource.query.mockResolvedValue([{ '?column?': 1 }]);

    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body).toEqual({ status: 'ok' });
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('503 sin filtrar el detalle si la base de datos falla', async () => {
    dataSource.query.mockRejectedValue(
      new Error('connect ECONNREFUSED 10.0.0.5:5432'),
    );

    const res = await request(app.getHttpServer()).get('/health').expect(503);

    expect(res.body).toMatchObject({
      statusCode: 503,
      message: 'Base de datos no disponible',
    });
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });
});

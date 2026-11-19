import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { FinancialSummaryController } from '../src/financial-summary/financial-summary.controller';
import { FinancialSummaryService } from '../src/financial-summary/financial-summary.service';
import { UsersService } from '../src/users/users.service';

const JWT_SECRET = 'secreto-e2e';
const USER_ID = 1;
const user = { id: USER_ID, name: 'Ana', email: 'ana@example.com' };

const summaryService = {
  getSummary: jest.fn(),
  getByCategory: jest.fn(),
  getMonthly: jest.fn(),
};
const usersService = { findById: jest.fn() };

/**
 * Controlador real de resumen con servicio simulado, guard JWT global y la
 * misma configuración de `main.ts` (ValidationPipe y filtro).
 */
describe('Summary (e2e)', () => {
  let app: INestApplication<App>;
  let auth: string;

  const expectNoServiceCalls = () => {
    expect(summaryService.getSummary).not.toHaveBeenCalled();
    expect(summaryService.getByCategory).not.toHaveBeenCalled();
    expect(summaryService.getMonthly).not.toHaveBeenCalled();
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      controllers: [FinancialSummaryController],
      providers: [
        { provide: FinancialSummaryService, useValue: summaryService },
        { provide: UsersService, useValue: usersService },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication<INestApplication<App>>({
      logger: false,
    });
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    const token = await new JwtService({ secret: JWT_SECRET }).signAsync({
      sub: USER_ID,
      email: user.email,
    });
    auth = `Bearer ${token}`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usersService.findById.mockResolvedValue(user);
    summaryService.getSummary.mockResolvedValue({});
    summaryService.getByCategory.mockResolvedValue({});
    summaryService.getMonthly.mockResolvedValue({});
  });

  it.each(['/summary', '/summary/by-category', '/summary/monthly'])(
    'GET %s sin token → 401',
    async (url) => {
      const res = await request(app.getHttpServer()).get(url).expect(401);

      expect(res.body).toMatchObject({ statusCode: 401, path: url });
      expectNoServiceCalls();
    },
  );

  it('token inválido → 401', async () => {
    await request(app.getHttpServer())
      .get('/summary')
      .set('Authorization', 'Bearer no-es-un-jwt')
      .expect(401);
    expectNoServiceCalls();
  });

  describe('GET /summary', () => {
    it('pasa el userId del token y mes/año numéricos al servicio', async () => {
      const summary = { month: 3, year: 2026, income: 100 };
      summaryService.getSummary.mockResolvedValue(summary);

      const res = await request(app.getHttpServer())
        .get('/summary?month=3&year=2026')
        .set('Authorization', auth)
        .expect(200);

      expect(res.body).toEqual(summary);
      expect(summaryService.getSummary).toHaveBeenCalledWith(USER_ID, {
        month: 3,
        year: 2026,
      });
    });

    it('sin query delega los valores por defecto al servicio', async () => {
      await request(app.getHttpServer())
        .get('/summary')
        .set('Authorization', auth)
        .expect(200);

      expect(summaryService.getSummary).toHaveBeenCalledWith(USER_ID, {});
    });

    it.each([
      ['month=13', 'month=13', 'El mes debe estar entre 1 y 12'],
      ['month=0', 'month=0', 'El mes debe estar entre 1 y 12'],
      ['month decimal', 'month=1.5', 'El mes debe ser un número entero'],
      ['month no numérico', 'month=abc', 'El mes debe ser un número entero'],
      ['year no numérico', 'year=abc', 'El año debe ser un número entero'],
      ['year=1999', 'year=1999', 'El año debe estar entre 2000 y 2100'],
      ['year=2101', 'year=2101', 'El año debe estar entre 2000 y 2100'],
      ['propiedad extra', 'foo=1', 'property foo should not exist'],
      ['userId en la query', 'userId=2', 'property userId should not exist'],
      [
        'type (solo existe en by-category)',
        'type=income',
        'property type should not exist',
      ],
    ])('%s → 400', async (_label, qs, message) => {
      const res = await request(app.getHttpServer())
        .get(`/summary?${qs}`)
        .set('Authorization', auth)
        .expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        error: 'BAD_REQUEST',
        path: `/summary?${qs}`,
      });
      expect(res.body.message).toContain(message);
      expectNoServiceCalls();
    });
  });

  describe('GET /summary/by-category', () => {
    it('pasa mes, año y tipo al servicio', async () => {
      await request(app.getHttpServer())
        .get('/summary/by-category?month=2&year=2026&type=income')
        .set('Authorization', auth)
        .expect(200);

      expect(summaryService.getByCategory).toHaveBeenCalledWith(USER_ID, {
        month: 2,
        year: 2026,
        type: 'income',
      });
    });

    it('sin query delega los valores por defecto al servicio', async () => {
      await request(app.getHttpServer())
        .get('/summary/by-category')
        .set('Authorization', auth)
        .expect(200);

      expect(summaryService.getByCategory).toHaveBeenCalledWith(USER_ID, {});
    });

    it.each([
      [
        'type inválido',
        'type=savings',
        'El tipo debe ser "income" o "expense"',
      ],
      [
        'type en mayúsculas',
        'type=EXPENSE',
        'El tipo debe ser "income" o "expense"',
      ],
      ['month=13', 'month=13', 'El mes debe estar entre 1 y 12'],
      ['month=0', 'month=0', 'El mes debe estar entre 1 y 12'],
      ['year no numérico', 'year=dos-mil', 'El año debe ser un número entero'],
      [
        'propiedad extra',
        'categoryId=3',
        'property categoryId should not exist',
      ],
    ])('%s → 400', async (_label, qs, message) => {
      const res = await request(app.getHttpServer())
        .get(`/summary/by-category?${qs}`)
        .set('Authorization', auth)
        .expect(400);

      expect(res.body.message).toContain(message);
      expectNoServiceCalls();
    });
  });

  describe('GET /summary/monthly', () => {
    it('pasa el año numérico al servicio', async () => {
      await request(app.getHttpServer())
        .get('/summary/monthly?year=2025')
        .set('Authorization', auth)
        .expect(200);

      expect(summaryService.getMonthly).toHaveBeenCalledWith(USER_ID, {
        year: 2025,
      });
    });

    it('sin query delega el año por defecto al servicio', async () => {
      await request(app.getHttpServer())
        .get('/summary/monthly')
        .set('Authorization', auth)
        .expect(200);

      expect(summaryService.getMonthly).toHaveBeenCalledWith(USER_ID, {});
    });

    it.each([
      ['year no numérico', 'year=abc', 'El año debe ser un número entero'],
      ['year decimal', 'year=2026.5', 'El año debe ser un número entero'],
      ['year=1999', 'year=1999', 'El año debe estar entre 2000 y 2100'],
      ['month (no aplica)', 'month=3', 'property month should not exist'],
      ['propiedad extra', 'foo=bar', 'property foo should not exist'],
    ])('%s → 400', async (_label, qs, message) => {
      const res = await request(app.getHttpServer())
        .get(`/summary/monthly?${qs}`)
        .set('Authorization', auth)
        .expect(400);

      expect(res.body.message).toContain(message);
      expectNoServiceCalls();
    });
  });
});

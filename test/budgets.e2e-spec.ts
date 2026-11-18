import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { BudgetsController } from '../src/budgets/budgets.controller';
import { BudgetsService } from '../src/budgets/budgets.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { UsersService } from '../src/users/users.service';

const JWT_SECRET = 'secreto-e2e';
const USER_ID = 1;
const user = { id: USER_ID, name: 'Ana', email: 'ana@example.com' };
const validBody = { categoryId: 3, amount: 500000, month: 1, year: 2026 };

const budgetsService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};
const usersService = { findById: jest.fn() };

/**
 * Controlador real de presupuestos con servicio simulado, guard JWT global y
 * la misma configuración de `main.ts` (ValidationPipe y filtro).
 */
describe('Budgets (e2e)', () => {
  let app: INestApplication<App>;
  let auth: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      controllers: [BudgetsController],
      providers: [
        { provide: BudgetsService, useValue: budgetsService },
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
  });

  it.each([
    ['get', '/budgets'],
    ['get', '/budgets/5'],
    ['post', '/budgets'],
    ['patch', '/budgets/5'],
    ['delete', '/budgets/5'],
  ] as const)('%s %s sin token → 401', async (method, url) => {
    await request(app.getHttpServer())[method](url).expect(401);
    expect(budgetsService.findAll).not.toHaveBeenCalled();
  });

  describe('GET /budgets', () => {
    it('pasa userId y mes/año numéricos al servicio', async () => {
      budgetsService.findAll.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/budgets?month=3&year=2026')
        .set('Authorization', auth)
        .expect(200);

      expect(budgetsService.findAll).toHaveBeenCalledWith(USER_ID, {
        month: 3,
        year: 2026,
      });
    });

    it('sin filtros usa los valores por defecto del servicio', async () => {
      budgetsService.findAll.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/budgets')
        .set('Authorization', auth)
        .expect(200);

      expect(budgetsService.findAll).toHaveBeenCalledWith(USER_ID, {});
    });

    it.each([
      ['month=13', 'month=13'],
      ['month=0', 'month=0'],
      ['month no numérico', 'month=abc'],
      ['year=1999', 'year=1999'],
      ['year=2101', 'year=2101'],
    ])('%s → 400', async (_label, qs) => {
      await request(app.getHttpServer())
        .get(`/budgets?${qs}`)
        .set('Authorization', auth)
        .expect(400);
      expect(budgetsService.findAll).not.toHaveBeenCalled();
    });
  });

  describe('GET /budgets/:id', () => {
    it('id no numérico → 400', async () => {
      await request(app.getHttpServer())
        .get('/budgets/abc')
        .set('Authorization', auth)
        .expect(400);
    });

    it('devuelve el presupuesto', async () => {
      budgetsService.findOne.mockResolvedValue({ id: 5 });

      await request(app.getHttpServer())
        .get('/budgets/5')
        .set('Authorization', auth)
        .expect(200);

      expect(budgetsService.findOne).toHaveBeenCalledWith(USER_ID, 5);
    });
  });

  describe('POST /budgets', () => {
    it('propiedades extra en el body → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/budgets')
        .set('Authorization', auth)
        .send({ ...validBody, userId: 99 })
        .expect(400);

      expect(res.body.message).toEqual(['property userId should not exist']);
      expect(budgetsService.create).not.toHaveBeenCalled();
    });

    it.each([
      ['month 13', { ...validBody, month: 13 }],
      ['month 0', { ...validBody, month: 0 }],
      ['month decimal', { ...validBody, month: 1.5 }],
      ['year 1999', { ...validBody, year: 1999 }],
      ['year 2101', { ...validBody, year: 2101 }],
      ['amount 0', { ...validBody, amount: 0 }],
      ['amount negativo', { ...validBody, amount: -10 }],
      ['amount con 3 decimales', { ...validBody, amount: 10.123 }],
      ['amount como texto', { ...validBody, amount: '100' }],
      ['sin categoryId', { amount: 10, month: 1, year: 2026 }],
      ['categoryId 0', { ...validBody, categoryId: 0 }],
    ])('%s → 400', async (_label, body) => {
      await request(app.getHttpServer())
        .post('/budgets')
        .set('Authorization', auth)
        .send(body)
        .expect(400);
      expect(budgetsService.create).not.toHaveBeenCalled();
    });

    it('body válido → 201 con el userId del token', async () => {
      budgetsService.create.mockResolvedValue({ id: 1 });

      await request(app.getHttpServer())
        .post('/budgets')
        .set('Authorization', auth)
        .send(validBody)
        .expect(201);

      expect(budgetsService.create).toHaveBeenCalledWith(USER_ID, validBody);
    });
  });

  describe('PATCH /budgets/:id', () => {
    it.each([
      ['categoryId', { amount: 10, categoryId: 4 }],
      ['month', { amount: 10, month: 2 }],
      ['year', { amount: 10, year: 2027 }],
    ])('intentar enviar %s → 400', async (field, body) => {
      const res = await request(app.getHttpServer())
        .patch('/budgets/5')
        .set('Authorization', auth)
        .send(body)
        .expect(400);

      expect(res.body.message).toEqual([`property ${field} should not exist`]);
      expect(budgetsService.update).not.toHaveBeenCalled();
    });

    it.each([
      ['sin amount', {}],
      ['amount null', { amount: null }],
      ['amount 0', { amount: 0 }],
      ['amount negativo', { amount: -1 }],
    ])('%s → 400', async (_label, body) => {
      await request(app.getHttpServer())
        .patch('/budgets/5')
        .set('Authorization', auth)
        .send(body)
        .expect(400);
      expect(budgetsService.update).not.toHaveBeenCalled();
    });

    it('actualiza el monto', async () => {
      budgetsService.update.mockResolvedValue({ id: 5, amount: 800 });

      await request(app.getHttpServer())
        .patch('/budgets/5')
        .set('Authorization', auth)
        .send({ amount: 800 })
        .expect(200);

      expect(budgetsService.update).toHaveBeenCalledWith(USER_ID, 5, {
        amount: 800,
      });
    });
  });

  describe('DELETE /budgets/:id', () => {
    it('devuelve { message }', async () => {
      budgetsService.remove.mockResolvedValue({ message: 'ok' });

      const res = await request(app.getHttpServer())
        .delete('/budgets/5')
        .set('Authorization', auth)
        .expect(200);

      expect(res.body).toEqual({ message: 'ok' });
      expect(budgetsService.remove).toHaveBeenCalledWith(USER_ID, 5);
    });
  });
});

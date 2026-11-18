import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { SavingsGoalsController } from '../src/savings-goals/savings-goals.controller';
import { SavingsGoalsService } from '../src/savings-goals/savings-goals.service';
import { UsersService } from '../src/users/users.service';

const JWT_SECRET = 'secreto-e2e';
const USER_ID = 1;
const user = { id: USER_ID, name: 'Ana', email: 'ana@example.com' };
const validGoal = {
  name: 'Viaje',
  targetAmount: 3000000,
  targetDate: '2027-06-30',
};

const savingsGoalsService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  deposit: jest.fn(),
  withdraw: jest.fn(),
  findMovements: jest.fn(),
};
const usersService = { findById: jest.fn() };

/**
 * Controlador real de metas de ahorro con servicio simulado, guard JWT global
 * y la misma configuración de `main.ts` (ValidationPipe y filtro).
 */
describe('SavingsGoals (e2e)', () => {
  let app: INestApplication<App>;
  let auth: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      controllers: [SavingsGoalsController],
      providers: [
        { provide: SavingsGoalsService, useValue: savingsGoalsService },
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

  const noServiceCalls = () => {
    for (const fn of Object.values(savingsGoalsService)) {
      expect(fn).not.toHaveBeenCalled();
    }
  };

  it.each([
    ['get', '/savings-goals'],
    ['get', '/savings-goals/5'],
    ['post', '/savings-goals'],
    ['patch', '/savings-goals/5'],
    ['delete', '/savings-goals/5'],
    ['post', '/savings-goals/5/deposits'],
    ['post', '/savings-goals/5/withdrawals'],
    ['get', '/savings-goals/5/movements'],
  ] as const)('%s %s sin token → 401', async (method, url) => {
    await request(app.getHttpServer())[method](url).expect(401);
    noServiceCalls();
  });

  describe('GET /savings-goals', () => {
    it('pasa userId, paginación y status al servicio', async () => {
      savingsGoalsService.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 2,
        limit: 5,
      });

      await request(app.getHttpServer())
        .get('/savings-goals?page=2&limit=5&status=completed')
        .set('Authorization', auth)
        .expect(200);

      expect(savingsGoalsService.findAll).toHaveBeenCalledWith(USER_ID, {
        page: 2,
        limit: 5,
        status: 'completed',
      });
    });

    it.each([
      ['status inválido', 'status=paused'],
      ['status en mayúsculas', 'status=ACTIVE'],
      ['page 0', 'page=0'],
      ['limit 101', 'limit=101'],
      ['parámetro desconocido', 'userId=2'],
    ])('%s → 400', async (_label, qs) => {
      const res = await request(app.getHttpServer())
        .get(`/savings-goals?${qs}`)
        .set('Authorization', auth)
        .expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        path: expect.any(String),
      });
      expect(savingsGoalsService.findAll).not.toHaveBeenCalled();
    });

    it('el mensaje de status inválido está en español', async () => {
      const res = await request(app.getHttpServer())
        .get('/savings-goals?status=paused')
        .set('Authorization', auth)
        .expect(400);

      expect(res.body.message).toEqual([
        'El estado debe ser "active" o "completed"',
      ]);
    });
  });

  describe('GET /savings-goals/:id', () => {
    it('id no numérico → 400', async () => {
      await request(app.getHttpServer())
        .get('/savings-goals/abc')
        .set('Authorization', auth)
        .expect(400);
      expect(savingsGoalsService.findOne).not.toHaveBeenCalled();
    });

    it('devuelve la meta', async () => {
      savingsGoalsService.findOne.mockResolvedValue({ id: 5 });

      await request(app.getHttpServer())
        .get('/savings-goals/5')
        .set('Authorization', auth)
        .expect(200);

      expect(savingsGoalsService.findOne).toHaveBeenCalledWith(USER_ID, 5);
    });
  });

  describe('POST /savings-goals', () => {
    it('body válido → 201 con el userId del token y el nombre recortado', async () => {
      savingsGoalsService.create.mockResolvedValue({ id: 1 });

      await request(app.getHttpServer())
        .post('/savings-goals')
        .set('Authorization', auth)
        .send({ ...validGoal, name: '  Viaje  ' })
        .expect(201);

      expect(savingsGoalsService.create).toHaveBeenCalledWith(
        USER_ID,
        validGoal,
      );
    });

    it('targetDate es opcional', async () => {
      savingsGoalsService.create.mockResolvedValue({ id: 1 });

      await request(app.getHttpServer())
        .post('/savings-goals')
        .set('Authorization', auth)
        .send({ name: 'Viaje', targetAmount: 100 })
        .expect(201);
    });

    it.each([
      ['currentAmount', { ...validGoal, currentAmount: 500 }],
      ['userId', { ...validGoal, userId: 99 }],
      ['status', { ...validGoal, status: 'completed' }],
    ])('propiedad extra %s → 400', async (field, body) => {
      const res = await request(app.getHttpServer())
        .post('/savings-goals')
        .set('Authorization', auth)
        .send(body)
        .expect(400);

      expect(res.body.message).toEqual([`property ${field} should not exist`]);
      expect(savingsGoalsService.create).not.toHaveBeenCalled();
    });

    it.each([
      ['sin name', { targetAmount: 100 }],
      ['name vacío', { ...validGoal, name: '   ' }],
      ['name de 151 caracteres', { ...validGoal, name: 'a'.repeat(151) }],
      ['sin targetAmount', { name: 'Viaje' }],
      ['targetAmount 0', { ...validGoal, targetAmount: 0 }],
      ['targetAmount negativo', { ...validGoal, targetAmount: -100 }],
      ['targetAmount con 3 decimales', { ...validGoal, targetAmount: 10.123 }],
      ['targetAmount como texto', { ...validGoal, targetAmount: '100' }],
      [
        'targetAmount mayor que decimal(12,2)',
        { ...validGoal, targetAmount: 10_000_000_000 },
      ],
      ['targetDate imposible', { ...validGoal, targetDate: '2027-02-30' }],
      [
        'targetDate con hora',
        { ...validGoal, targetDate: '2027-06-30T00:00:00Z' },
      ],
    ])('%s → 400', async (_label, body) => {
      await request(app.getHttpServer())
        .post('/savings-goals')
        .set('Authorization', auth)
        .send(body)
        .expect(400);
      expect(savingsGoalsService.create).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /savings-goals/:id', () => {
    it('actualiza parcialmente', async () => {
      savingsGoalsService.update.mockResolvedValue({ id: 5 });

      await request(app.getHttpServer())
        .patch('/savings-goals/5')
        .set('Authorization', auth)
        .send({ targetAmount: 500, targetDate: null })
        .expect(200);

      expect(savingsGoalsService.update).toHaveBeenCalledWith(USER_ID, 5, {
        targetAmount: 500,
        targetDate: null,
      });
    });

    it('currentAmount no se puede editar → 400', async () => {
      const res = await request(app.getHttpServer())
        .patch('/savings-goals/5')
        .set('Authorization', auth)
        .send({ currentAmount: 1000 })
        .expect(400);

      expect(res.body.message).toEqual([
        'property currentAmount should not exist',
      ]);
      expect(savingsGoalsService.update).not.toHaveBeenCalled();
    });

    it.each([
      ['name null', { name: null }],
      ['targetAmount null', { targetAmount: null }],
      ['targetAmount negativo', { targetAmount: -5 }],
      ['targetAmount con 3 decimales', { targetAmount: 1.005 }],
    ])('%s → 400', async (_label, body) => {
      await request(app.getHttpServer())
        .patch('/savings-goals/5')
        .set('Authorization', auth)
        .send(body)
        .expect(400);
      expect(savingsGoalsService.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /savings-goals/:id', () => {
    it('devuelve { message }', async () => {
      savingsGoalsService.remove.mockResolvedValue({ message: 'ok' });

      const res = await request(app.getHttpServer())
        .delete('/savings-goals/5')
        .set('Authorization', auth)
        .expect(200);

      expect(res.body).toEqual({ message: 'ok' });
      expect(savingsGoalsService.remove).toHaveBeenCalledWith(USER_ID, 5);
    });
  });

  describe.each([
    ['deposits', 'deposit'],
    ['withdrawals', 'withdraw'],
  ] as const)('POST /savings-goals/:id/%s', (path, method) => {
    const url = `/savings-goals/5/${path}`;

    it('monto válido → 201', async () => {
      savingsGoalsService[method].mockResolvedValue({
        movement: { id: 1 },
        goal: { id: 5 },
      });

      await request(app.getHttpServer())
        .post(url)
        .set('Authorization', auth)
        .send({ amount: 150.25 })
        .expect(201);

      expect(savingsGoalsService[method]).toHaveBeenCalledWith(USER_ID, 5, {
        amount: 150.25,
      });
    });

    it.each([
      ['monto negativo', { amount: -10 }],
      ['monto 0', { amount: 0 }],
      ['monto con 3 decimales', { amount: 10.123 }],
      ['monto como texto', { amount: '10' }],
      ['monto mayor que decimal(12,2)', { amount: 10_000_000_000 }],
      ['sin monto', {}],
      ['monto null', { amount: null }],
    ])('%s → 400', async (_label, body) => {
      await request(app.getHttpServer())
        .post(url)
        .set('Authorization', auth)
        .send(body)
        .expect(400);
      expect(savingsGoalsService[method]).not.toHaveBeenCalled();
    });

    it('propiedades extra → 400', async () => {
      const res = await request(app.getHttpServer())
        .post(url)
        .set('Authorization', auth)
        .send({ amount: 10, type: 'deposit' })
        .expect(400);

      expect(res.body.message).toEqual(['property type should not exist']);
      expect(savingsGoalsService[method]).not.toHaveBeenCalled();
    });

    it('id no numérico → 400', async () => {
      await request(app.getHttpServer())
        .post(`/savings-goals/abc/${path}`)
        .set('Authorization', auth)
        .send({ amount: 10 })
        .expect(400);
      expect(savingsGoalsService[method]).not.toHaveBeenCalled();
    });
  });

  describe('GET /savings-goals/:id/movements', () => {
    it('pasa userId, id y paginación', async () => {
      savingsGoalsService.findMovements.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      await request(app.getHttpServer())
        .get('/savings-goals/5/movements?limit=10')
        .set('Authorization', auth)
        .expect(200);

      expect(savingsGoalsService.findMovements).toHaveBeenCalledWith(
        USER_ID,
        5,
        { page: 1, limit: 10 },
      );
    });

    it('filtro desconocido → 400', async () => {
      await request(app.getHttpServer())
        .get('/savings-goals/5/movements?type=deposit')
        .set('Authorization', auth)
        .expect(400);
      expect(savingsGoalsService.findMovements).not.toHaveBeenCalled();
    });
  });
});

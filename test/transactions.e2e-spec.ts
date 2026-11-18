import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { CategoryType } from '../src/categories/enums/category-type.enum';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransactionsController } from '../src/transactions/transactions.controller';
import { TransactionsService } from '../src/transactions/transactions.service';
import { UsersService } from '../src/users/users.service';

const JWT_SECRET = 'secreto-e2e';
const USER_ID = 1;
const user = { id: USER_ID, name: 'Ana', email: 'ana@example.com' };
const transaction = {
  id: 20,
  amount: 50.25,
  type: CategoryType.EXPENSE,
  description: 'Mercado',
  date: '2026-01-15',
  categoryId: 3,
  userId: USER_ID,
  category: { id: 3, name: 'Alimentación', type: CategoryType.EXPENSE },
};
const validBody = {
  amount: 50.25,
  type: 'expense',
  categoryId: 3,
  date: '2026-01-15',
  description: 'Mercado',
};

const transactionsService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};
const usersService = { findById: jest.fn() };

/**
 * Controlador real de transacciones con servicio simulado, guard JWT global y
 * la misma configuración de `main.ts` (ValidationPipe y filtro).
 */
describe('Transactions (e2e)', () => {
  let app: INestApplication<App>;
  let auth: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      controllers: [TransactionsController],
      providers: [
        { provide: TransactionsService, useValue: transactionsService },
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
    for (const fn of Object.values(transactionsService)) {
      expect(fn).not.toHaveBeenCalled();
    }
  };

  it.each([
    ['get', '/transactions'],
    ['get', '/transactions/20'],
    ['post', '/transactions'],
    ['patch', '/transactions/20'],
    ['delete', '/transactions/20'],
  ] as const)('%s %s sin token → 401', async (method, url) => {
    await request(app.getHttpServer())[method](url).expect(401);
    noServiceCalls();
  });

  describe('GET /transactions', () => {
    it('sin query usa la paginación por defecto', async () => {
      const page = { data: [transaction], total: 1, page: 1, limit: 20 };
      transactionsService.findAll.mockResolvedValue(page);

      const res = await request(app.getHttpServer())
        .get('/transactions')
        .set('Authorization', auth)
        .expect(200);

      expect(res.body).toEqual(page);
      expect(transactionsService.findAll).toHaveBeenCalledWith(USER_ID, {
        page: 1,
        limit: 20,
      });
    });

    it('convierte y pasa los filtros al servicio', async () => {
      transactionsService.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 2,
        limit: 5,
      });

      await request(app.getHttpServer())
        .get(
          '/transactions?type=income&categoryId=3&from=2026-01-01&to=2026-01-01&page=2&limit=5',
        )
        .set('Authorization', auth)
        .expect(200);

      expect(transactionsService.findAll).toHaveBeenCalledWith(USER_ID, {
        type: CategoryType.INCOME,
        categoryId: 3,
        from: '2026-01-01',
        to: '2026-01-01',
        page: 2,
        limit: 5,
      });
    });

    it.each([
      [
        'from > to',
        '?from=2026-02-01&to=2026-01-31',
        'La fecha "from" no puede ser posterior a "to"',
      ],
      ['limit=1000', '?limit=1000', 'limit debe ser como máximo 100'],
      ['page=0', '?page=0', 'page debe ser como mínimo 1'],
      [
        'from inválido',
        '?from=2026-02-30',
        'from debe ser una fecha válida con formato YYYY-MM-DD',
      ],
      [
        'to con hora',
        '?to=2026-01-31T10:00:00Z',
        'to debe ser una fecha válida con formato YYYY-MM-DD',
      ],
      ['type inválido', '?type=otro', 'El tipo debe ser "income" o "expense"'],
      [
        'categoryId no numérico',
        '?categoryId=abc',
        'categoryId debe ser un número entero',
      ],
      ['parámetro extra', '?userId=2', 'property userId should not exist'],
    ])('%s → 400', async (_label, qs, message) => {
      const res = await request(app.getHttpServer())
        .get(`/transactions${qs}`)
        .set('Authorization', auth)
        .expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        error: 'BAD_REQUEST',
        path: `/transactions${qs}`,
      });
      expect(res.body.message).toContain(message);
      noServiceCalls();
    });
  });

  describe('GET /transactions/:id', () => {
    it('id no numérico → 400', async () => {
      await request(app.getHttpServer())
        .get('/transactions/abc')
        .set('Authorization', auth)
        .expect(400);
      noServiceCalls();
    });

    it('devuelve la transacción con su categoría', async () => {
      transactionsService.findOne.mockResolvedValue(transaction);

      const res = await request(app.getHttpServer())
        .get('/transactions/20')
        .set('Authorization', auth)
        .expect(200);

      expect(res.body).toEqual(transaction);
      expect(transactionsService.findOne).toHaveBeenCalledWith(USER_ID, 20);
    });
  });

  describe('POST /transactions', () => {
    it('crea con 201 usando el userId del token', async () => {
      transactionsService.create.mockResolvedValue(transaction);

      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', auth)
        .send({ ...validBody, description: '  Mercado  ' })
        .expect(201);

      expect(transactionsService.create).toHaveBeenCalledWith(USER_ID, {
        ...validBody,
        type: CategoryType.EXPENSE,
      });
    });

    it('description vacía se envía como null', async () => {
      transactionsService.create.mockResolvedValue(transaction);

      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', auth)
        .send({ ...validBody, description: '   ' })
        .expect(201);

      expect(transactionsService.create).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ description: null }),
      );
    });

    it.each([
      ['monto negativo', { amount: -10 }, 'El monto debe ser mayor que 0'],
      ['monto cero', { amount: 0 }, 'El monto debe ser mayor que 0'],
      [
        'monto con 3 decimales',
        { amount: 10.555 },
        'El monto debe ser un número con 2 decimales como máximo',
      ],
      [
        'monto como texto',
        { amount: '10' },
        'El monto debe ser un número con 2 decimales como máximo',
      ],
      [
        'monto fuera de decimal(12,2)',
        { amount: 10_000_000_000 },
        'El monto no puede superar 9999999999.99',
      ],
      [
        'fecha inválida',
        { date: '2026-02-30' },
        'La fecha debe ser válida y tener el formato YYYY-MM-DD',
      ],
      [
        'fecha con hora',
        { date: '2026-01-15T10:00:00Z' },
        'La fecha debe ser válida y tener el formato YYYY-MM-DD',
      ],
      [
        'tipo inválido',
        { type: 'transfer' },
        'El tipo debe ser "income" o "expense"',
      ],
      [
        'categoryId decimal',
        { categoryId: 1.5 },
        'La categoría debe ser un id entero',
      ],
      [
        'descripción larga',
        { description: 'x'.repeat(256) },
        'La descripción no puede superar los 255 caracteres',
      ],
      ['propiedad extra', { userId: 99 }, 'property userId should not exist'],
    ])('%s → 400', async (_label, override, message) => {
      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', auth)
        .send({ ...validBody, ...override })
        .expect(400);

      expect(res.body.message).toContain(message);
      noServiceCalls();
    });

    it.each(['amount', 'type', 'categoryId', 'date'])(
      'sin %s → 400',
      async (field) => {
        const body: Record<string, unknown> = { ...validBody };
        delete body[field];

        await request(app.getHttpServer())
          .post('/transactions')
          .set('Authorization', auth)
          .send(body)
          .expect(400);
        noServiceCalls();
      },
    );
  });

  describe('PATCH /transactions/:id', () => {
    it('actualización parcial', async () => {
      transactionsService.update.mockResolvedValue(transaction);

      await request(app.getHttpServer())
        .patch('/transactions/20')
        .set('Authorization', auth)
        .send({ amount: 80 })
        .expect(200);

      expect(transactionsService.update).toHaveBeenCalledWith(USER_ID, 20, {
        amount: 80,
      });
    });

    it('description null se acepta para borrarla', async () => {
      transactionsService.update.mockResolvedValue(transaction);

      await request(app.getHttpServer())
        .patch('/transactions/20')
        .set('Authorization', auth)
        .send({ description: null })
        .expect(200);

      expect(transactionsService.update).toHaveBeenCalledWith(USER_ID, 20, {
        description: null,
      });
    });

    it.each([
      ['amount null', { amount: null }],
      ['type null', { type: null }],
      ['categoryId null', { categoryId: null }],
      ['date null', { date: null }],
      ['monto negativo', { amount: -1 }],
      ['monto con 3 decimales', { amount: 1.001 }],
      ['fecha inválida', { date: '2026-13-01' }],
      ['propiedad extra', { userId: 2 }],
    ])('%s → 400', async (_label, body) => {
      await request(app.getHttpServer())
        .patch('/transactions/20')
        .set('Authorization', auth)
        .send(body)
        .expect(400);
      noServiceCalls();
    });
  });

  describe('DELETE /transactions/:id', () => {
    it('devuelve { message }', async () => {
      transactionsService.remove.mockResolvedValue({ message: 'ok' });

      const res = await request(app.getHttpServer())
        .delete('/transactions/20')
        .set('Authorization', auth)
        .expect(200);

      expect(res.body).toEqual({ message: 'ok' });
      expect(transactionsService.remove).toHaveBeenCalledWith(USER_ID, 20);
    });
  });
});

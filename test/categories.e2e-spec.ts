import {
  ConflictException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { QueryFailedError } from 'typeorm';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { CategoriesController } from '../src/categories/categories.controller';
import { CategoriesService } from '../src/categories/categories.service';
import { CategoryType } from '../src/categories/enums/category-type.enum';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { UsersService } from '../src/users/users.service';

const JWT_SECRET = 'secreto-e2e';
const USER_ID = 1;
const user = { id: USER_ID, name: 'Ana', email: 'ana@example.com' };
const category = {
  id: 5,
  name: 'Mascotas',
  type: CategoryType.EXPENSE,
  userId: USER_ID,
};

const categoriesService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};
const usersService = { findById: jest.fn() };

/**
 * Controlador real de categorías con servicio simulado, guard JWT global y
 * la misma configuración de `main.ts` (ValidationPipe y filtro).
 */
describe('Categories (e2e)', () => {
  let app: INestApplication<App>;
  let auth: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      controllers: [CategoriesController],
      providers: [
        { provide: CategoriesService, useValue: categoriesService },
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
    ['get', '/categories'],
    ['get', '/categories/5'],
    ['post', '/categories'],
    ['patch', '/categories/5'],
    ['delete', '/categories/5'],
  ] as const)('%s %s sin token → 401', async (method, url) => {
    await request(app.getHttpServer())[method](url).expect(401);
    expect(categoriesService.findAll).not.toHaveBeenCalled();
  });

  describe('GET /categories', () => {
    it('usa el userId del token y el filtro de tipo', async () => {
      categoriesService.findAll.mockResolvedValue([category]);

      const res = await request(app.getHttpServer())
        .get('/categories?type=expense')
        .set('Authorization', auth)
        .expect(200);

      expect(res.body).toEqual([category]);
      expect(categoriesService.findAll).toHaveBeenCalledWith(
        USER_ID,
        CategoryType.EXPENSE,
      );
    });

    it('sin type lista todas', async () => {
      categoriesService.findAll.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/categories')
        .set('Authorization', auth)
        .expect(200);

      expect(categoriesService.findAll).toHaveBeenCalledWith(
        USER_ID,
        undefined,
      );
    });

    it('type inválido → 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/categories?type=otro')
        .set('Authorization', auth)
        .expect(400);

      expect(res.body.message).toEqual([
        'El tipo debe ser "income" o "expense"',
      ]);
      expect(categoriesService.findAll).not.toHaveBeenCalled();
    });
  });

  describe('GET /categories/:id', () => {
    it('id no numérico → 400', async () => {
      await request(app.getHttpServer())
        .get('/categories/abc')
        .set('Authorization', auth)
        .expect(400);
    });

    it('devuelve la categoría', async () => {
      categoriesService.findOne.mockResolvedValue(category);

      await request(app.getHttpServer())
        .get('/categories/5')
        .set('Authorization', auth)
        .expect(200);

      expect(categoriesService.findOne).toHaveBeenCalledWith(USER_ID, 5);
    });
  });

  describe('POST /categories', () => {
    it('propiedades extra en el body → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', auth)
        .send({ name: 'Mascotas', type: 'expense', userId: 99 })
        .expect(400);

      expect(res.body.message).toEqual(['property userId should not exist']);
      expect(categoriesService.create).not.toHaveBeenCalled();
    });

    it.each([
      ['nombre vacío', { name: '   ', type: 'expense' }],
      ['sin nombre', { type: 'expense' }],
      ['tipo inválido', { name: 'X', type: 'otro' }],
      ['sin tipo', { name: 'X' }],
    ])('%s → 400', async (_label, body) => {
      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', auth)
        .send(body)
        .expect(400);
      expect(categoriesService.create).not.toHaveBeenCalled();
    });

    it('recorta espacios del nombre y responde 201', async () => {
      categoriesService.create.mockResolvedValue(category);

      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', auth)
        .send({ name: '  Mascotas  ', type: 'expense' })
        .expect(201);

      expect(categoriesService.create).toHaveBeenCalledWith(USER_ID, {
        name: 'Mascotas',
        type: CategoryType.EXPENSE,
      });
    });
  });

  describe('PATCH /categories/:id', () => {
    it('intentar enviar type → 400', async () => {
      const res = await request(app.getHttpServer())
        .patch('/categories/5')
        .set('Authorization', auth)
        .send({ name: 'Perros', type: 'income' })
        .expect(400);

      expect(res.body.message).toEqual(['property type should not exist']);
      expect(categoriesService.update).not.toHaveBeenCalled();
    });

    it('sin name → 400', async () => {
      await request(app.getHttpServer())
        .patch('/categories/5')
        .set('Authorization', auth)
        .send({})
        .expect(400);
    });

    it('actualiza el nombre', async () => {
      categoriesService.update.mockResolvedValue({
        ...category,
        name: 'Perros',
      });

      await request(app.getHttpServer())
        .patch('/categories/5')
        .set('Authorization', auth)
        .send({ name: 'Perros' })
        .expect(200);

      expect(categoriesService.update).toHaveBeenCalledWith(USER_ID, 5, {
        name: 'Perros',
      });
    });
  });

  describe('DELETE /categories/:id', () => {
    it('devuelve { message }', async () => {
      categoriesService.remove.mockResolvedValue({ message: 'ok' });

      const res = await request(app.getHttpServer())
        .delete('/categories/5')
        .set('Authorization', auth)
        .expect(200);

      expect(res.body).toEqual({ message: 'ok' });
      expect(categoriesService.remove).toHaveBeenCalledWith(USER_ID, 5);
    });

    it('con transacciones asociadas → 409 con el mensaje del servicio', async () => {
      categoriesService.remove.mockRejectedValue(
        new ConflictException('La categoría tiene transacciones asociadas'),
      );

      const res = await request(app.getHttpServer())
        .delete('/categories/5')
        .set('Authorization', auth)
        .expect(409);

      expect(res.body).toMatchObject({
        statusCode: 409,
        error: 'CONFLICT',
        message: 'La categoría tiene transacciones asociadas',
        path: '/categories/5',
      });
    });

    it('un 23503 sin capturar también llega al filtro como 409', async () => {
      categoriesService.remove.mockRejectedValue(
        new QueryFailedError('DELETE', [], {
          code: '23503',
        } as unknown as Error),
      );

      const res = await request(app.getHttpServer())
        .delete('/categories/5')
        .set('Authorization', auth)
        .expect(409);

      expect(res.body).toMatchObject({
        statusCode: 409,
        message: 'La operación viola una relación con otro registro',
      });
    });
  });
});

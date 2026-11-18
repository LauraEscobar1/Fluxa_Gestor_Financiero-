import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { SavingsGoalMovement } from './entities/savings-goal-movement.entity';
import { SavingsGoal } from './entities/savings-goal.entity';
import { SavingsGoalMovementType } from './enums/savings-goal-movement-type.enum';
import { SavingsGoalStatus } from './enums/savings-goal-status.enum';
import { SavingsGoalsService } from './savings-goals.service';

describe('SavingsGoalsService', () => {
  let service: SavingsGoalsService;

  const USER_ID = 1;
  const TODAY = '2026-03-15';

  const listQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };
  const goalsRepository = {
    createQueryBuilder: jest.fn(() => listQb),
    findOneBy: jest.fn(),
    existsBy: jest.fn(),
    create: jest.fn((data: Partial<SavingsGoal>) => ({ ...data })),
    save: jest.fn(async (g: Partial<SavingsGoal>) => ({ id: 10, ...g })),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const movementsRepository = { findAndCount: jest.fn() };

  /** Repositorios que entrega el `EntityManager` de la transacción. */
  const updateQb = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };
  const txGoals = {
    createQueryBuilder: jest.fn(() => updateQb),
    existsBy: jest.fn(),
    findOneByOrFail: jest.fn(),
  };
  const txMovements = {
    create: jest.fn((data: Partial<SavingsGoalMovement>) => ({ ...data })),
    save: jest.fn(async (m: Partial<SavingsGoalMovement>) => ({
      id: 50,
      createdAt: new Date('2026-03-15T12:00:00Z'),
      ...m,
    })),
  };
  const manager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === SavingsGoal ? txGoals : txMovements,
    ),
  };
  const dataSource = {
    transaction: jest.fn(async (work: (m: typeof manager) => unknown) =>
      work(manager),
    ),
  };

  const goal = (over: Partial<SavingsGoal> = {}): SavingsGoal =>
    ({
      id: 10,
      name: 'Viaje',
      targetAmount: 1000,
      currentAmount: 0,
      targetDate: null,
      userId: USER_ID,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      ...over,
    }) as SavingsGoal;

  beforeAll(() => {
    jest.useFakeTimers({ now: new Date(`${TODAY}T12:00:00Z`) });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    for (const qb of [listQb, updateQb]) {
      for (const [name, fn] of Object.entries(qb)) {
        if (name !== 'getManyAndCount' && name !== 'execute') {
          fn.mockReturnThis();
        }
      }
    }
    const moduleRef = await Test.createTestingModule({
      providers: [
        SavingsGoalsService,
        { provide: getRepositoryToken(SavingsGoal), useValue: goalsRepository },
        {
          provide: getRepositoryToken(SavingsGoalMovement),
          useValue: movementsRepository,
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = moduleRef.get(SavingsGoalsService);
  });

  describe('create', () => {
    it('crea la meta del usuario con saldo 0 y la devuelve con campos calculados', async () => {
      goalsRepository.findOneBy.mockResolvedValue(
        goal({ targetDate: '2026-12-31' }),
      );

      const result = await service.create(USER_ID, {
        name: 'Viaje',
        targetAmount: 1000,
        targetDate: '2026-12-31',
      });

      expect(goalsRepository.save).toHaveBeenCalledWith({
        userId: USER_ID,
        name: 'Viaje',
        targetAmount: 1000,
        currentAmount: 0,
        targetDate: '2026-12-31',
      });
      expect(goalsRepository.findOneBy).toHaveBeenCalledWith({
        id: 10,
        userId: USER_ID,
      });
      expect(result).toMatchObject({
        id: 10,
        currentAmount: 0,
        status: SavingsGoalStatus.ACTIVE,
        progressPercent: 0,
        remaining: 1000,
        targetDate: '2026-12-31',
      });
    });

    it('sin targetDate la guarda como null', async () => {
      goalsRepository.findOneBy.mockResolvedValue(goal());

      await service.create(USER_ID, { name: 'Viaje', targetAmount: 1000 });

      expect(goalsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ targetDate: null }),
      );
    });

    it('acepta hoy como targetDate', async () => {
      goalsRepository.findOneBy.mockResolvedValue(goal({ targetDate: TODAY }));

      await expect(
        service.create(USER_ID, {
          name: 'Viaje',
          targetAmount: 1000,
          targetDate: TODAY,
        }),
      ).resolves.toMatchObject({ targetDate: TODAY });
    });

    it('targetDate en el pasado → 400 sin guardar', async () => {
      await expect(
        service.create(USER_ID, {
          name: 'Viaje',
          targetAmount: 1000,
          targetDate: '2026-03-14',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(goalsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('cálculo de status, progressPercent y remaining', () => {
    it.each([
      ['sin saldo', 0, 1000, SavingsGoalStatus.ACTIVE, 0, 1000],
      ['a mitad', 500, 1000, SavingsGoalStatus.ACTIVE, 50, 500],
      ['redondea a 2 decimales', 1, 3, SavingsGoalStatus.ACTIVE, 33.33, 2],
      ['exacta', 1000, 1000, SavingsGoalStatus.COMPLETED, 100, 0],
      [
        'superada: tope en 100',
        1500,
        1000,
        SavingsGoalStatus.COMPLETED,
        100,
        0,
      ],
      [
        'casi completa: nunca 100 si sigue activa',
        9999.99,
        10000,
        SavingsGoalStatus.ACTIVE,
        99.99,
        0.01,
      ],
      ['decimales sin ruido', 0.1, 0.3, SavingsGoalStatus.ACTIVE, 33.33, 0.2],
    ])(
      '%s',
      async (
        _label,
        currentAmount,
        targetAmount,
        status,
        progress,
        remaining,
      ) => {
        goalsRepository.findOneBy.mockResolvedValue(
          goal({ currentAmount, targetAmount }),
        );

        const result = await service.findOne(USER_ID, 10);

        expect(result).toMatchObject({
          status,
          progressPercent: progress,
          remaining,
        });
      },
    );
  });

  describe('findAll', () => {
    it('pagina, ordena por más reciente y filtra por usuario', async () => {
      listQb.getManyAndCount.mockResolvedValue([[goal()], 21]);

      const result = await service.findAll(USER_ID, { page: 2, limit: 20 });

      expect(listQb.where).toHaveBeenCalledWith('goal.userId = :userId', {
        userId: USER_ID,
      });
      expect(listQb.andWhere).not.toHaveBeenCalled();
      expect(listQb.orderBy).toHaveBeenCalledWith('goal.createdAt', 'DESC');
      expect(listQb.skip).toHaveBeenCalledWith(20);
      expect(listQb.take).toHaveBeenCalledWith(20);
      expect(result).toMatchObject({ total: 21, page: 2, limit: 20 });
      expect(result.data[0].status).toBe(SavingsGoalStatus.ACTIVE);
    });

    it.each([
      [SavingsGoalStatus.COMPLETED, 'goal.currentAmount >= goal.targetAmount'],
      [SavingsGoalStatus.ACTIVE, 'goal.currentAmount < goal.targetAmount'],
    ])('status=%s se traduce a SQL', async (status, condition) => {
      listQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(USER_ID, { page: 1, limit: 20, status });

      expect(listQb.andWhere).toHaveBeenCalledWith(condition);
    });
  });

  describe('update', () => {
    it('actualiza solo los campos enviados, sin tocar currentAmount', async () => {
      goalsRepository.update.mockResolvedValue({ affected: 1 });
      goalsRepository.findOneBy.mockResolvedValue(
        goal({ currentAmount: 800, targetAmount: 500 }),
      );

      const result = await service.update(USER_ID, 10, { targetAmount: 500 });

      expect(goalsRepository.update).toHaveBeenCalledWith(
        { id: 10, userId: USER_ID },
        { targetAmount: 500 },
      );
      expect(goalsRepository.save).not.toHaveBeenCalled();
      // Objetivo por debajo del saldo: queda completada, no es un error.
      expect(result.status).toBe(SavingsGoalStatus.COMPLETED);
    });

    it('targetDate null quita la fecha límite', async () => {
      goalsRepository.update.mockResolvedValue({ affected: 1 });
      goalsRepository.findOneBy.mockResolvedValue(goal());

      await service.update(USER_ID, 10, { targetDate: null });

      expect(goalsRepository.update).toHaveBeenCalledWith(
        { id: 10, userId: USER_ID },
        { targetDate: null },
      );
    });

    it('targetDate en el pasado → 400', async () => {
      await expect(
        service.update(USER_ID, 10, { targetDate: '2025-01-01' }),
      ).rejects.toThrow(BadRequestException);
      expect(goalsRepository.update).not.toHaveBeenCalled();
    });

    it('meta de otro usuario → 404', async () => {
      goalsRepository.update.mockResolvedValue({ affected: 0 });

      await expect(service.update(2, 10, { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
      expect(goalsRepository.update).toHaveBeenCalledWith(
        { id: 10, userId: 2 },
        { name: 'X' },
      );
    });
  });

  describe('remove', () => {
    it('devuelve { message } al eliminar', async () => {
      goalsRepository.delete.mockResolvedValue({ affected: 1 });

      await expect(service.remove(USER_ID, 10)).resolves.toEqual({
        message: 'Meta de ahorro eliminada correctamente',
      });
      expect(goalsRepository.delete).toHaveBeenCalledWith({
        id: 10,
        userId: USER_ID,
      });
    });

    it('meta de otro usuario → 404', async () => {
      goalsRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove(2, 10)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deposit', () => {
    it('suma con un UPDATE atómico y registra el movimiento en la misma transacción', async () => {
      updateQb.execute.mockResolvedValue({ affected: 1 });
      txGoals.findOneByOrFail.mockResolvedValue(goal({ currentAmount: 250.5 }));

      const result = await service.deposit(USER_ID, 10, { amount: 250.5 });

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      const [[setArg]] = updateQb.set.mock.calls as unknown as [
        [{ currentAmount: () => string }],
      ];
      expect(setArg.currentAmount()).toBe('current_amount + :amount');
      expect(updateQb.setParameter).toHaveBeenCalledWith('amount', 250.5);
      expect(updateQb.where).toHaveBeenCalledWith('id = :id', { id: 10 });
      expect(updateQb.andWhere).toHaveBeenCalledWith('user_id = :userId', {
        userId: USER_ID,
      });
      expect(updateQb.andWhere).not.toHaveBeenCalledWith(
        'current_amount >= :amount',
      );
      expect(txMovements.save).toHaveBeenCalledWith({
        goalId: 10,
        amount: 250.5,
        type: SavingsGoalMovementType.DEPOSIT,
      });
      expect(result.movement).toMatchObject({
        id: 50,
        goalId: 10,
        amount: 250.5,
        type: SavingsGoalMovementType.DEPOSIT,
      });
      expect(result.goal).toMatchObject({
        currentAmount: 250.5,
        progressPercent: 25.05,
        remaining: 749.5,
        status: SavingsGoalStatus.ACTIVE,
      });
    });

    it('meta de otro usuario → 404 sin registrar movimiento', async () => {
      updateQb.execute.mockResolvedValue({ affected: 0 });

      await expect(service.deposit(2, 10, { amount: 10 })).rejects.toThrow(
        NotFoundException,
      );
      expect(updateQb.andWhere).toHaveBeenCalledWith('user_id = :userId', {
        userId: 2,
      });
      expect(txMovements.save).not.toHaveBeenCalled();
    });

    it('desbordamiento de decimal(12,2) → 400', async () => {
      const overflow = new QueryFailedError('UPDATE', [], {
        code: '22003',
      } as unknown as Error);
      updateQb.execute.mockRejectedValue(overflow);

      await expect(
        service.deposit(USER_ID, 10, { amount: 9_999_999_999.99 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('withdraw', () => {
    it('resta con la condición de saldo dentro del UPDATE y registra el movimiento', async () => {
      updateQb.execute.mockResolvedValue({ affected: 1 });
      txGoals.findOneByOrFail.mockResolvedValue(goal({ currentAmount: 300 }));

      const result = await service.withdraw(USER_ID, 10, { amount: 200 });

      const [[setArg]] = updateQb.set.mock.calls as unknown as [
        [{ currentAmount: () => string }],
      ];
      expect(setArg.currentAmount()).toBe('current_amount - :amount');
      expect(updateQb.andWhere).toHaveBeenCalledWith(
        'current_amount >= :amount',
      );
      expect(txMovements.save).toHaveBeenCalledWith({
        goalId: 10,
        amount: 200,
        type: SavingsGoalMovementType.WITHDRAWAL,
      });
      expect(result.goal.currentAmount).toBe(300);
    });

    it('retiro mayor al saldo → 400 "Fondos insuficientes" sin registrar movimiento', async () => {
      updateQb.execute.mockResolvedValue({ affected: 0 });
      txGoals.existsBy.mockResolvedValue(true);

      await expect(
        service.withdraw(USER_ID, 10, { amount: 5000 }),
      ).rejects.toThrow(
        new BadRequestException('Fondos insuficientes en la meta'),
      );
      expect(txGoals.existsBy).toHaveBeenCalledWith({
        id: 10,
        userId: USER_ID,
      });
      expect(txMovements.save).not.toHaveBeenCalled();
    });

    it('meta de otro usuario → 404 (no revela que existe)', async () => {
      updateQb.execute.mockResolvedValue({ affected: 0 });
      txGoals.existsBy.mockResolvedValue(false);

      await expect(service.withdraw(2, 10, { amount: 10 })).rejects.toThrow(
        NotFoundException,
      );
      expect(txGoals.existsBy).toHaveBeenCalledWith({ id: 10, userId: 2 });
      expect(txMovements.save).not.toHaveBeenCalled();
    });
  });

  describe('findOne / findMovements', () => {
    it('findOne de otro usuario → 404 (se filtra por userId)', async () => {
      goalsRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(2, 10)).rejects.toThrow(NotFoundException);
      expect(goalsRepository.findOneBy).toHaveBeenCalledWith({
        id: 10,
        userId: 2,
      });
    });

    it('historial paginado, más reciente primero', async () => {
      goalsRepository.existsBy.mockResolvedValue(true);
      movementsRepository.findAndCount.mockResolvedValue([
        [
          {
            id: 2,
            goalId: 10,
            amount: 50,
            type: SavingsGoalMovementType.WITHDRAWAL,
            createdAt: new Date('2026-03-02'),
          },
        ],
        2,
      ]);

      const result = await service.findMovements(USER_ID, 10, {
        page: 1,
        limit: 1,
      });

      expect(movementsRepository.findAndCount).toHaveBeenCalledWith({
        where: { goalId: 10 },
        order: { createdAt: 'DESC', id: 'DESC' },
        skip: 0,
        take: 1,
      });
      expect(result).toMatchObject({ total: 2, page: 1, limit: 1 });
      expect(result.data).toHaveLength(1);
    });

    it('historial de una meta de otro usuario → 404', async () => {
      goalsRepository.existsBy.mockResolvedValue(false);

      await expect(
        service.findMovements(2, 10, { page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);
      expect(goalsRepository.existsBy).toHaveBeenCalledWith({
        id: 10,
        userId: 2,
      });
      expect(movementsRepository.findAndCount).not.toHaveBeenCalled();
    });
  });
});

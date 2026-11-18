import { Budget } from '../../budgets/entities/budget.entity';
import { DEFAULT_CATEGORIES } from '../../categories/default-categories';
import { Category } from '../../categories/entities/category.entity';
import { hashPassword } from '../../common/password';
import { SavingsGoalMovement } from '../../savings-goals/entities/savings-goal-movement.entity';
import { SavingsGoal } from '../../savings-goals/entities/savings-goal.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { User } from '../../users/entities/user.entity';
import dataSource from '../data-source';
import { DEMO_USER, balanceOf, buildDemoData } from './demo-data';

/**
 * Seed de datos de demostración (`npm run seed`). Requiere que las tablas ya
 * existan (migraciones o `DB_SYNCHRONIZE=true`).
 *
 * - Idempotente: si `demo@fluxa.com` ya existe no hace nada, así que se puede
 *   ejecutar varias veces sin duplicar datos.
 * - Se niega a correr con `NODE_ENV=production`.
 * - Todo se inserta en una sola transacción: o queda completo o no queda nada.
 */
async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed de demostración no se ejecuta en producción.');
  }

  await dataSource.initialize();
  try {
    const created = await dataSource.transaction(async (manager) => {
      const users = manager.getRepository(User);
      if (await users.existsBy({ email: DEMO_USER.email })) {
        return false;
      }

      const user = await users.save(
        users.create({
          name: DEMO_USER.name,
          email: DEMO_USER.email,
          passwordHash: await hashPassword(DEMO_USER.password),
        }),
      );
      const userId = user.id;
      const demo = buildDemoData();

      // Categorías por defecto (mismas que crea el registro).
      const categories = manager.getRepository(Category);
      await categories.insert(
        DEFAULT_CATEGORIES.map((category) => ({ ...category, userId })),
      );
      const categoryId = new Map(
        (await categories.findBy({ userId })).map((c) => [c.name, c.id]),
      );
      const idOf = (name: string): number => {
        const id = categoryId.get(name);
        if (id === undefined) {
          throw new Error(`Categoría de demo desconocida: ${name}`);
        }
        return id;
      };

      await manager.getRepository(Transaction).insert(
        demo.transactions.map((t) => ({
          userId,
          categoryId: idOf(t.category),
          type: t.type,
          amount: t.amount,
          date: t.date,
          description: t.description,
        })),
      );

      const now = new Date();
      await manager.getRepository(Budget).insert(
        demo.budgets.map((b) => ({
          userId,
          categoryId: idOf(b.category),
          amount: b.amount,
          month: now.getUTCMonth() + 1,
          year: now.getUTCFullYear(),
        })),
      );

      for (const goal of demo.goals) {
        const saved = await manager.getRepository(SavingsGoal).save(
          manager.getRepository(SavingsGoal).create({
            userId,
            name: goal.name,
            targetAmount: goal.targetAmount,
            currentAmount: balanceOf(goal.movements),
            targetDate: goal.targetDate,
          }),
        );
        await manager.getRepository(SavingsGoalMovement).insert(
          goal.movements.map((m) => ({
            goalId: saved.id,
            type: m.type,
            amount: m.amount,
            createdAt: new Date(now.getTime() - m.daysAgo * 86_400_000),
          })),
        );
      }
      return true;
    });

    console.log(
      created
        ? `Seed completado: usuario ${DEMO_USER.email} (contraseña ${DEMO_USER.password}).`
        : `El usuario ${DEMO_USER.email} ya existe: no se hizo nada.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});

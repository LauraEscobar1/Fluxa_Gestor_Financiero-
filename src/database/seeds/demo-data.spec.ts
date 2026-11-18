import { CategoryType } from '../../categories/enums/category-type.enum';
import { DEFAULT_CATEGORIES } from '../../categories/default-categories';
import { isDateOnly, toDateOnly } from '../../common/dates';
import { balanceOf, buildDemoData } from './demo-data';

describe('buildDemoData', () => {
  const dates = [
    new Date('2026-11-18T12:00:00Z'),
    new Date('2026-03-01T00:00:00Z'), // día 1: nada puede quedar en el futuro
    new Date('2026-01-31T23:59:00Z'), // meses previos más cortos
    new Date('2024-02-29T10:00:00Z'), // bisiesto
  ];

  it.each(dates)(
    'transacciones coherentes y sin fechas futuras (%s)',
    (today) => {
      const { transactions } = buildDemoData(today);
      const todayText = toDateOnly(today);

      expect(transactions.length).toBeGreaterThanOrEqual(38);
      expect(transactions.length).toBeLessThanOrEqual(42);
      for (const t of transactions) {
        expect(isDateOnly(t.date)).toBe(true);
        expect(t.date <= todayText).toBe(true);
        expect(t.amount).toBeGreaterThan(0);
        // El tipo coincide con el de la categoría por defecto.
        const category = DEFAULT_CATEGORIES.find((c) => c.name === t.category);
        expect(category?.type).toBe(t.type);
      }
    },
  );

  it('reparte las transacciones en los últimos 3 meses con ingresos y gastos', () => {
    const today = new Date('2026-11-18T12:00:00Z');
    const { transactions } = buildDemoData(today);

    const months = new Set(transactions.map((t) => t.date.slice(0, 7)));
    expect([...months].sort()).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(transactions.some((t) => t.type === CategoryType.INCOME)).toBe(true);
    expect(transactions.some((t) => t.type === CategoryType.EXPENSE)).toBe(
      true,
    );
  });

  it('presupuestos de gasto: uno cerca del límite y uno excedido', () => {
    const today = new Date('2026-11-18T12:00:00Z');
    const { transactions, budgets } = buildDemoData(today);

    const spent = (category: string) =>
      transactions
        .filter(
          (t) =>
            t.category === category &&
            t.type === CategoryType.EXPENSE &&
            t.date.startsWith('2026-11'),
        )
        .reduce((sum, t) => sum + t.amount, 0);
    const percent = (b: { category: string; amount: number }) =>
      (spent(b.category) / b.amount) * 100;

    expect(budgets).toHaveLength(3);
    const percents = budgets.map(percent);
    expect(percents.some((p) => p >= 80 && p <= 100)).toBe(true);
    expect(percents.some((p) => p > 100)).toBe(true);
    for (const b of budgets) {
      expect(DEFAULT_CATEGORIES.find((c) => c.name === b.category)?.type).toBe(
        CategoryType.EXPENSE,
      );
    }
  });

  it('metas con movimientos y saldo nunca negativo', () => {
    const { goals } = buildDemoData(new Date('2026-11-18T12:00:00Z'));

    expect(goals).toHaveLength(2);
    for (const goal of goals) {
      expect(goal.movements.length).toBeGreaterThan(0);
      expect(balanceOf(goal.movements)).toBeGreaterThanOrEqual(0);
      expect(goal.targetDate && goal.targetDate > '2026-11-18').toBe(true);
    }
  });
});

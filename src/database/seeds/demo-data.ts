import { CategoryType } from '../../categories/enums/category-type.enum';
import { SavingsGoalMovementType } from '../../savings-goals/enums/savings-goal-movement-type.enum';

/** Credenciales del usuario demo (solo para desarrollo y demostraciones). */
export const DEMO_USER = {
  name: 'Usuario Demo',
  email: 'demo@fluxa.com',
  password: 'Demo1234',
} as const;

export interface DemoTransaction {
  /** Nombre de una categoría por defecto del tipo indicado. */
  category: string;
  type: CategoryType;
  amount: number;
  /** `YYYY-MM-DD`, nunca posterior a hoy. */
  date: string;
  description: string;
}

export interface DemoBudget {
  category: string;
  amount: number;
}

export interface DemoGoalMovement {
  type: SavingsGoalMovementType;
  amount: number;
  daysAgo: number;
}

export interface DemoGoal {
  name: string;
  targetAmount: number;
  /** `YYYY-MM-DD` o `null`. */
  targetDate: string | null;
  movements: DemoGoalMovement[];
}

export interface DemoData {
  transactions: DemoTransaction[];
  budgets: DemoBudget[];
  goals: DemoGoal[];
}

type Row = [
  day: number,
  type: CategoryType,
  category: string,
  amount: number,
  description: string,
];

const { INCOME, EXPENSE } = CategoryType;

/** Movimientos típicos de un mes completo (14 transacciones). */
const FULL_MONTH: Row[] = [
  [1, INCOME, 'Salario', 3_500_000, 'Salario del mes'],
  [15, INCOME, 'Freelance', 450_000, 'Proyecto freelance'],
  [3, EXPENSE, 'Vivienda', 1_100_000, 'Arriendo'],
  [5, EXPENSE, 'Servicios', 220_000, 'Servicios públicos'],
  [7, EXPENSE, 'Alimentación', 180_000, 'Mercado'],
  [14, EXPENSE, 'Alimentación', 150_000, 'Mercado'],
  [21, EXPENSE, 'Alimentación', 170_000, 'Mercado'],
  [28, EXPENSE, 'Alimentación', 140_000, 'Restaurantes'],
  [9, EXPENSE, 'Transporte', 60_000, 'Transporte público'],
  [22, EXPENSE, 'Transporte', 55_000, 'Gasolina'],
  [12, EXPENSE, 'Entretenimiento', 90_000, 'Cine y salidas'],
  [18, EXPENSE, 'Salud', 80_000, 'Consulta médica'],
  [10, EXPENSE, 'Educación', 200_000, 'Curso en línea'],
  [25, EXPENSE, 'Ropa', 130_000, 'Ropa'],
];

/**
 * Movimientos del mes actual (12 transacciones). Los gastos por categoría
 * están pensados para los presupuestos de demo: Alimentación 500 000,
 * Transporte 115 000 y Entretenimiento 90 000.
 */
const CURRENT_MONTH: Row[] = [
  [1, INCOME, 'Salario', 3_500_000, 'Salario del mes'],
  [15, INCOME, 'Freelance', 600_000, 'Proyecto freelance'],
  [3, EXPENSE, 'Vivienda', 1_100_000, 'Arriendo'],
  [5, EXPENSE, 'Servicios', 220_000, 'Servicios públicos'],
  [2, EXPENSE, 'Alimentación', 180_000, 'Mercado'],
  [8, EXPENSE, 'Alimentación', 150_000, 'Mercado'],
  [16, EXPENSE, 'Alimentación', 170_000, 'Mercado'],
  [4, EXPENSE, 'Transporte', 60_000, 'Transporte público'],
  [12, EXPENSE, 'Transporte', 55_000, 'Gasolina'],
  [10, EXPENSE, 'Entretenimiento', 90_000, 'Cine y salidas'],
  [14, EXPENSE, 'Ropa', 120_000, 'Ropa'],
  [18, EXPENSE, 'Salud', 80_000, 'Consulta médica'],
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Suma `months` meses a `today` (UTC) y devuelve `[año, mes 1-12]`. */
function shiftMonth(today: Date, months: number): [number, number] {
  const date = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + months, 1),
  );
  return [date.getUTCFullYear(), date.getUTCMonth() + 1];
}

/** Fecha `YYYY-MM-DD` de `today` desplazada `months` meses (día 1 del mes + `day`). */
function dateOf(today: Date, monthOffset: number, day: number): string {
  const [year, month] = shiftMonth(today, monthOffset);
  const isCurrent = monthOffset === 0;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const maxDay = isCurrent ? today.getUTCDate() : daysInMonth;
  return `${year}-${pad(month)}-${pad(Math.min(day, maxDay))}`;
}

/** `today` + `months` meses como `YYYY-MM-DD` (mismo día del mes, ajustado al fin de mes). */
function addMonths(today: Date, months: number): string {
  const [year, month] = shiftMonth(today, months);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(today.getUTCDate(), daysInMonth))}`;
}

/**
 * Construye los datos de demo relativos a `today`: ~40 transacciones en los
 * últimos 3 meses (ninguna en el futuro), 3 presupuestos del mes actual
 * (cerca del límite, excedido y holgado) y 2 metas de ahorro con movimientos.
 * Es una función pura: no toca la base de datos.
 */
export function buildDemoData(today: Date = new Date()): DemoData {
  const transactions: DemoTransaction[] = [];
  const addRows = (rows: Row[], monthOffset: number) => {
    for (const [day, type, category, amount, description] of rows) {
      transactions.push({
        category,
        type,
        amount,
        date: dateOf(today, monthOffset, day),
        description,
      });
    }
  };
  addRows(FULL_MONTH, -2);
  addRows(FULL_MONTH, -1);
  addRows(CURRENT_MONTH, 0);

  return {
    transactions,
    budgets: [
      // 500 000 de 580 000 → ~86 %: "warning".
      { category: 'Alimentación', amount: 580_000 },
      // 115 000 de 100 000 → 115 %: "exceeded".
      { category: 'Transporte', amount: 100_000 },
      // 90 000 de 300 000 → 30 %: "ok".
      { category: 'Entretenimiento', amount: 300_000 },
    ],
    goals: [
      {
        name: 'Fondo de emergencia',
        targetAmount: 5_000_000,
        targetDate: addMonths(today, 12),
        movements: [
          {
            type: SavingsGoalMovementType.DEPOSIT,
            amount: 1_000_000,
            daysAgo: 75,
          },
          {
            type: SavingsGoalMovementType.DEPOSIT,
            amount: 800_000,
            daysAgo: 45,
          },
          {
            type: SavingsGoalMovementType.WITHDRAWAL,
            amount: 200_000,
            daysAgo: 30,
          },
          {
            type: SavingsGoalMovementType.DEPOSIT,
            amount: 700_000,
            daysAgo: 10,
          },
        ],
      },
      {
        name: 'Viaje a la playa',
        targetAmount: 1_500_000,
        targetDate: addMonths(today, 3),
        movements: [
          {
            type: SavingsGoalMovementType.DEPOSIT,
            amount: 600_000,
            daysAgo: 60,
          },
          {
            type: SavingsGoalMovementType.DEPOSIT,
            amount: 600_000,
            daysAgo: 30,
          },
          {
            type: SavingsGoalMovementType.DEPOSIT,
            amount: 300_000,
            daysAgo: 5,
          },
        ],
      },
    ],
  };
}

/** Saldo resultante de una lista de movimientos (depósitos suman, retiros restan). */
export function balanceOf(movements: DemoGoalMovement[]): number {
  return movements.reduce(
    (total, m) =>
      total +
      (m.type === SavingsGoalMovementType.DEPOSIT ? m.amount : -m.amount),
    0,
  );
}

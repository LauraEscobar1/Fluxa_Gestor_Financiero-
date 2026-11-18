/** Estado de un presupuesto según lo gastado en su mes. */
export enum BudgetStatus {
  /** Gasto por debajo del 80 % del límite. */
  OK = 'ok',
  /** Gasto igual o superior al 80 % del límite, sin pasarlo. */
  WARNING = 'warning',
  /** Gasto mayor que el límite. */
  EXCEEDED = 'exceeded',
}

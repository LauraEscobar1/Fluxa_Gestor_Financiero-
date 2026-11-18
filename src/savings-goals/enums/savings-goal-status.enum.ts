/**
 * Estado de una meta de ahorro. No se guarda: se calcula comparando el saldo
 * (`currentAmount`) con el objetivo (`targetAmount`).
 */
export enum SavingsGoalStatus {
  /** Todavía no se alcanzó el objetivo. */
  ACTIVE = 'active',
  /** El saldo es igual o mayor que el objetivo. */
  COMPLETED = 'completed',
}

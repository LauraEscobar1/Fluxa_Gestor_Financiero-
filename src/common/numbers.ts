/** Redondea a 2 decimales (evita ruido de coma flotante como 0.1 + 0.2). */
export const round2 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Convierte un agregado de Postgres a número con 2 decimales. `SUM` sobre
 * `decimal` llega como string (o `null` si no hay filas), `COUNT` como string.
 */
export const toAmount = (value: string | number | null | undefined): number =>
  value === null || value === undefined ? 0 : round2(Number(value));

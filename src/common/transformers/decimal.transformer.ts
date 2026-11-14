import type { ValueTransformer } from 'typeorm';

/**
 * Postgres devuelve las columnas `decimal` como string; este transformer las
 * convierte a número al leer y deja el valor tal cual al escribir.
 */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? value : parseFloat(value),
};

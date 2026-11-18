import { ValidateBy, ValidationOptions } from 'class-validator';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Indica si `value` es una fecha de calendario real en formato `YYYY-MM-DD`
 * (sin hora ni zona horaria). Rechaza fechas imposibles como `2026-02-30`.
 */
export function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Formatea una fecha como `YYYY-MM-DD` usando su día en UTC. */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Suma `years` años a una fecha `YYYY-MM-DD` (el 29 de febrero pasa al 1 de
 * marzo si el año resultante no es bisiesto).
 */
export function addYears(dateOnly: string, years: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return toDateOnly(new Date(Date.UTC(year + years, month - 1, day)));
}

/**
 * Valida que la propiedad sea una fecha `YYYY-MM-DD` válida. Las fechas sin
 * hora se manejan como texto en toda la API (columnas `date` de Postgres).
 */
export function IsDateOnly(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isDateOnly',
      validator: {
        validate: (value: unknown) => isDateOnly(value),
        defaultMessage: (args) =>
          `${args?.property} debe ser una fecha válida con formato YYYY-MM-DD`,
      },
    },
    options,
  );
}

/**
 * Valida que la fecha `YYYY-MM-DD` de la propiedad sea igual o posterior a la
 * de `property` en el mismo objeto. Si alguna de las dos falta o no es una
 * fecha válida no compara (de eso se encarga `@IsDateOnly`).
 */
export function IsOnOrAfterDate(
  property: string,
  options?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isOnOrAfterDate',
      constraints: [property],
      validator: {
        validate: (value: unknown, args) => {
          const target = args?.object as Record<string, unknown> | undefined;
          const other = target?.[property];
          if (!isDateOnly(value) || !isDateOnly(other)) return true;
          return value >= other;
        },
        defaultMessage: (args) =>
          `${args?.property} debe ser igual o posterior a ${property}`,
      },
    },
    options,
  );
}

/**
 * Primer día del mes y primer día del mes siguiente como `YYYY-MM-DD`. Sirve
 * para filtrar columnas `date` con `>= start` y `< end` (comparación de texto
 * que aprovecha el índice).
 */
export function monthRange(
  month: number,
  year: number,
): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${nextYear}-${pad(nextMonth)}-01`,
  };
}

/** Primer día del año y primer día del siguiente como `YYYY-MM-DD`. */
export function yearRange(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year + 1}-01-01` };
}

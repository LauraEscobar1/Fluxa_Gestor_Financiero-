/** Variables de entorno que usan estas utilidades (todas opcionales). */
export interface RuntimeEnv {
  NODE_ENV?: string;
  CORS_ORIGIN?: string;
  DB_SYNCHRONIZE?: string;
}

/** Indica si la app corre en producción. */
export const isProduction = (env: RuntimeEnv): boolean =>
  env.NODE_ENV === 'production';

/**
 * Opciones de CORS según `CORS_ORIGIN` (lista de orígenes separados por comas):
 * - con valor: solo esos orígenes;
 * - sin valor en desarrollo: abierto (cualquier origen);
 * - sin valor en producción: `false` (CORS desactivado).
 */
export function resolveCorsOrigin(env: RuntimeEnv): string[] | boolean {
  const origins = (env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length > 0) return origins;
  return !isProduction(env);
}

/**
 * Impide arrancar en producción con `DB_SYNCHRONIZE=true`: `synchronize`
 * puede borrar columnas y datos para igualar las entidades.
 * @throws Error con un mensaje claro si la combinación es peligrosa.
 */
export function assertSafeDatabaseConfig(env: RuntimeEnv): void {
  if (isProduction(env) && env.DB_SYNCHRONIZE === 'true') {
    throw new Error(
      'Configuración insegura: DB_SYNCHRONIZE=true no está permitido con NODE_ENV=production. ' +
        'Pon DB_SYNCHRONIZE=false y aplica el esquema con "npm run migration:run".',
    );
  }
}

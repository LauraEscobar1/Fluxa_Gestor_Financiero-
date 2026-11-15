import { ConfigService } from '@nestjs/config';
import type { JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';

/** Duración del token si `JWT_EXPIRES_IN` no está definido. */
export const DEFAULT_JWT_EXPIRES_IN = '1h';

/**
 * Opciones de `JwtModule` a partir del entorno. Lanza un error (y la API no
 * arranca) si falta `JWT_SECRET`: nunca se usa un secreto por defecto.
 *
 * `JWT_EXPIRES_IN` acepta el formato de `ms` (`15m`, `1h`, `7d`) o un número
 * de segundos (`3600`). Un número en texto se convierte a número porque
 * jsonwebtoken interpretaría `"3600"` como milisegundos.
 */
export function jwtModuleOptionsFactory(
  config: ConfigService,
): JwtModuleOptions {
  const secret = config.get<string>('JWT_SECRET')?.trim();
  if (!secret) {
    throw new Error(
      'JWT_SECRET no está definido. Agrégalo al archivo .env (ver .env.example) antes de iniciar la API.',
    );
  }

  const rawExpiresIn =
    config.get<string>('JWT_EXPIRES_IN')?.trim() || DEFAULT_JWT_EXPIRES_IN;
  const expiresIn = /^\d+$/.test(rawExpiresIn)
    ? Number(rawExpiresIn)
    : (rawExpiresIn as NonNullable<JwtSignOptions['expiresIn']>);

  return { secret, signOptions: { expiresIn } };
}

import { compare, hash } from 'bcrypt';

/** Coste de bcrypt (2^12 iteraciones): ~250 ms por hash en un equipo actual. */
export const BCRYPT_ROUNDS = 12;

/** Genera el hash bcrypt de una contraseña en texto plano. */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain, BCRYPT_ROUNDS);
}

/** Compara una contraseña en texto plano con su hash bcrypt. */
export function verifyPassword(
  plain: string,
  passwordHash: string,
): Promise<boolean> {
  return compare(plain, passwordHash);
}

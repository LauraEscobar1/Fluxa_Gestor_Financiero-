import { SetMetadata } from '@nestjs/common';

/** Clave de metadatos que `JwtAuthGuard` consulta con `Reflector`. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca un endpoint (o un controlador entero) como público: el guard global
 * `JwtAuthGuard` no exige token. Úsalo solo en rutas como registro y login.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

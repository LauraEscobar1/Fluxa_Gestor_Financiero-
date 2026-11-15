/** Contenido del access token. */
export interface JwtPayload {
  /** Id del usuario. */
  sub: number;
  email: string;
  /** Emitido en (segundos epoch); lo añade jsonwebtoken. */
  iat?: number;
  /** Expira en (segundos epoch); lo añade jsonwebtoken. */
  exp?: number;
}

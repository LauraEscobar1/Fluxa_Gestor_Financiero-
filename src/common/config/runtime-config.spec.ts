import { assertSafeDatabaseConfig, resolveCorsOrigin } from './runtime-config';

describe('resolveCorsOrigin', () => {
  it('usa la lista separada por comas, sin espacios ni vacíos', () => {
    expect(
      resolveCorsOrigin({
        CORS_ORIGIN: ' http://localhost:5173, https://app.fluxa.com ,,',
        NODE_ENV: 'production',
      }),
    ).toEqual(['http://localhost:5173', 'https://app.fluxa.com']);
  });

  it('sin CORS_ORIGIN está abierto en desarrollo', () => {
    expect(resolveCorsOrigin({})).toBe(true);
    expect(resolveCorsOrigin({ NODE_ENV: 'development' })).toBe(true);
  });

  it('sin CORS_ORIGIN está desactivado en producción', () => {
    expect(resolveCorsOrigin({ NODE_ENV: 'production' })).toBe(false);
    expect(
      resolveCorsOrigin({ NODE_ENV: 'production', CORS_ORIGIN: ' ' }),
    ).toBe(false);
  });
});

describe('assertSafeDatabaseConfig', () => {
  it('rechaza synchronize en producción con un mensaje claro', () => {
    expect(() =>
      assertSafeDatabaseConfig({
        NODE_ENV: 'production',
        DB_SYNCHRONIZE: 'true',
      }),
    ).toThrow(/DB_SYNCHRONIZE=true no está permitido/);
  });

  it.each([
    [{ NODE_ENV: 'production', DB_SYNCHRONIZE: 'false' }],
    [{ NODE_ENV: 'production' }],
    [{ NODE_ENV: 'development', DB_SYNCHRONIZE: 'true' }],
    [{ DB_SYNCHRONIZE: 'true' }],
  ])('permite %j', (env) => {
    expect(() => assertSafeDatabaseConfig(env)).not.toThrow();
  });
});

import { decimalTransformer } from './decimal.transformer';

describe('decimalTransformer', () => {
  it('convierte el string de Postgres a número al leer', () => {
    expect(decimalTransformer.from('1234.50')).toBe(1234.5);
    expect(decimalTransformer.from('0.00')).toBe(0);
  });

  it('conserva null y undefined al leer', () => {
    expect(decimalTransformer.from(null)).toBeNull();
    expect(decimalTransformer.from(undefined)).toBeUndefined();
  });

  it('deja el valor tal cual al escribir', () => {
    expect(decimalTransformer.to(99.99)).toBe(99.99);
    expect(decimalTransformer.to(null)).toBeNull();
  });
});

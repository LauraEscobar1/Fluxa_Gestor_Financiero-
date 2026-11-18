import { round2, toAmount } from './numbers';

describe('numbers', () => {
  it('round2 redondea a 2 decimales sin ruido de coma flotante', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(-150.555)).toBe(-150.55);
  });

  it.each([
    ['1234.50', 1234.5],
    ['0', 0],
    [null, 0],
    [undefined, 0],
    [42, 42],
  ])('toAmount(%p) → %p', (value, expected) => {
    expect(toAmount(value)).toBe(expected);
  });
});

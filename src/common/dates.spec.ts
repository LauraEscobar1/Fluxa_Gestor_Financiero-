import { validate } from 'class-validator';
import {
  addYears,
  currentMonthYear,
  isDateOnly,
  IsDateOnly,
  IsOnOrAfterDate,
  monthRange,
  toDateOnly,
  yearRange,
} from './dates';

describe('dates', () => {
  describe('isDateOnly', () => {
    it.each(['2026-01-15', '2024-02-29', '1999-12-31'])('%s es válida', (v) =>
      expect(isDateOnly(v)).toBe(true),
    );

    it.each([
      '2026-02-30',
      '2025-02-29',
      '2026-13-01',
      '2026-1-5',
      '2026-01-15T00:00:00Z',
      '15/01/2026',
      '',
      20260115,
      null,
    ])('%p no es válida', (v) => expect(isDateOnly(v)).toBe(false));
  });

  it('toDateOnly usa el día UTC', () => {
    expect(toDateOnly(new Date('2026-06-15T23:59:59Z'))).toBe('2026-06-15');
  });

  it('addYears suma años y desborda el 29 de febrero', () => {
    expect(addYears('2026-06-15', 1)).toBe('2027-06-15');
    expect(addYears('2024-02-29', 1)).toBe('2025-03-01');
  });

  it('monthRange devuelve el primer día del mes y del siguiente', () => {
    expect(monthRange(3, 2026)).toEqual({
      start: '2026-03-01',
      end: '2026-04-01',
    });
    expect(monthRange(12, 2026)).toEqual({
      start: '2026-12-01',
      end: '2027-01-01',
    });
  });

  it('yearRange devuelve el primer día del año y del siguiente', () => {
    expect(yearRange(2026)).toEqual({ start: '2026-01-01', end: '2027-01-01' });
  });

  describe('currentMonthYear (America/Bogota)', () => {
    it('a las 8 p. m. del último día del mes en Colombia sigue siendo ese mes', () => {
      // 2026-12-01T01:00Z = 30 de noviembre, 8:00 p. m. en Bogotá.
      expect(currentMonthYear(new Date('2026-12-01T01:00:00Z'))).toEqual({
        month: 11,
        year: 2026,
      });
    });

    it('el último segundo del año en Colombia sigue siendo diciembre', () => {
      // 2027-01-01T04:59:59Z = 31 de diciembre de 2026, 11:59:59 p. m. en Bogotá.
      expect(currentMonthYear(new Date('2027-01-01T04:59:59Z'))).toEqual({
        month: 12,
        year: 2026,
      });
    });

    it('a las 00:00 del día 1 en Colombia cambia de mes y de año', () => {
      expect(currentMonthYear(new Date('2027-01-01T05:00:00Z'))).toEqual({
        month: 1,
        year: 2027,
      });
      expect(currentMonthYear(new Date('2026-03-01T05:00:00Z'))).toEqual({
        month: 3,
        year: 2026,
      });
    });

    it('a mitad de mes coincide con UTC', () => {
      expect(currentMonthYear(new Date('2026-03-15T12:00:00Z'))).toEqual({
        month: 3,
        year: 2026,
      });
    });

    it('sin argumento usa la fecha actual', () => {
      jest.useFakeTimers({ now: new Date('2026-12-01T01:00:00Z') });
      try {
        expect(currentMonthYear()).toEqual({ month: 11, year: 2026 });
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('decoradores', () => {
    class Range {
      @IsDateOnly()
      from: unknown;

      @IsDateOnly()
      @IsOnOrAfterDate('from')
      to: unknown;
    }
    const range = (from: unknown, to: unknown) =>
      Object.assign(new Range(), { from, to });

    it('acepta un rango válido (incluido el mismo día)', async () => {
      expect(await validate(range('2026-01-01', '2026-01-31'))).toHaveLength(0);
      expect(await validate(range('2026-01-01', '2026-01-01'))).toHaveLength(0);
    });

    it('rechaza from > to', async () => {
      const [error] = await validate(range('2026-02-01', '2026-01-31'));
      expect(error.property).toBe('to');
      expect(error.constraints).toEqual({
        isOnOrAfterDate: 'to debe ser igual o posterior a from',
      });
    });

    it('si una fecha no es válida solo falla @IsDateOnly', async () => {
      const [error] = await validate(range('2026-02-01', 'mañana'));
      expect(error.constraints).toEqual({
        isDateOnly: 'to debe ser una fecha válida con formato YYYY-MM-DD',
      });
    });
  });
});

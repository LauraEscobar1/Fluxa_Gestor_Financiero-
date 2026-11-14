import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto, pageOptions, paginated } from './pagination';

describe('pagination', () => {
  const toDto = (plain: Record<string, unknown>) =>
    plainToInstance(PaginationQueryDto, plain);

  it('usa page=1 y limit=20 por defecto', async () => {
    const dto = toDto({});
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('convierte strings de la query a número', async () => {
    const dto = toDto({ page: '2', limit: '50' });
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([
    [{ page: '0' }, 'page'],
    [{ limit: '0' }, 'limit'],
    [{ limit: '101' }, 'limit'],
    [{ page: '1.5' }, 'page'],
    [{ page: 'abc' }, 'page'],
  ])('rechaza %j', async (plain, property) => {
    const errors = await validate(toDto(plain));
    expect(errors.map((e) => e.property)).toContain(property);
  });

  it('pageOptions calcula skip y take', () => {
    expect(pageOptions(toDto({ page: '3', limit: '10' }))).toEqual({
      skip: 20,
      take: 10,
    });
  });

  it('paginated arma la respuesta estándar', () => {
    const result = paginated(['a', 'b'], 12, toDto({ page: '2', limit: '2' }));
    expect(result).toEqual({ data: ['a', 'b'], total: 12, page: 2, limit: 2 });
  });
});

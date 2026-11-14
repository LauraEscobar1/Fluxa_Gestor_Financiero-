import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/ruta' }),
    }),
  } as unknown as ArgumentsHost;

  const lastBody = () => json.mock.calls[json.mock.calls.length - 1][0];

  beforeEach(() => {
    jest.clearAllMocks();
    status.mockReturnValue({ json });
    jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
  });

  it('respeta HttpException con formato unificado', () => {
    filter.catch(new NotFoundException('No encontrado'), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(lastBody()).toMatchObject({
      statusCode: 404,
      error: 'NOT_FOUND',
      message: 'No encontrado',
      path: '/ruta',
    });
    expect(typeof lastBody().timestamp).toBe('string');
  });

  it('conserva message array de errores de validación', () => {
    filter.catch(
      new BadRequestException(['email inválido', 'name vacío']),
      host,
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(lastBody().message).toEqual(['email inválido', 'name vacío']);
  });

  it('conserva campos extra de HttpException', () => {
    filter.catch(
      new HttpException({ message: 'x', code: 'CUSTOM' }, 418),
      host,
    );
    expect(lastBody()).toMatchObject({ statusCode: 418, code: 'CUSTOM' });
  });

  it.each([
    ['23505', 409],
    ['23503', 409],
    ['23502', 400],
    ['22P02', 400],
    ['22003', 400],
  ])('traduce QueryFailedError %s a %i', (code, expected) => {
    const error = new QueryFailedError('SELECT 1', [], {
      code,
      detail: 'detalle secreto',
    } as unknown as Error);
    filter.catch(error, host);
    expect(status).toHaveBeenCalledWith(expected);
    expect(JSON.stringify(lastBody())).not.toContain('detalle secreto');
  });

  it('QueryFailedError desconocido responde 500', () => {
    const error = new QueryFailedError('SELECT 1', [], {
      code: '99999',
    } as unknown as Error);
    filter.catch(error, host);
    expect(status).toHaveBeenCalledWith(500);
    expect(lastBody().message).toBe('Error interno del servidor');
  });

  it('error desconocido responde 500 sin filtrar detalles', () => {
    filter.catch(new Error('password=secreto'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(lastBody().message).toBe('Error interno del servidor');
    expect(JSON.stringify(lastBody())).not.toContain('secreto');
    expect(filter['logger'].error).toHaveBeenCalled();
  });

  it('ConflictException mantiene 409', () => {
    filter.catch(new ConflictException('Duplicado'), host);
    expect(status).toHaveBeenCalledWith(409);
  });
});

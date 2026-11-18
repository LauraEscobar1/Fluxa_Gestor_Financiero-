import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const dataSource = { query: jest.fn() };
  const controller = new HealthController(dataSource as never);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  it('devuelve ok si SELECT 1 responde', async () => {
    dataSource.query.mockResolvedValue([]);

    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('lanza 503 si la consulta falla', async () => {
    dataSource.query.mockRejectedValue(new Error('conexión caída'));

    await expect(controller.check()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});

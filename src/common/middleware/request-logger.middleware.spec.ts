import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { requestLogger } from './request-logger.middleware';

describe('requestLogger', () => {
  const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

  beforeEach(() => jest.clearAllMocks());
  afterAll(() => jest.restoreAllMocks());

  /** Ejecuta el middleware y dispara `finish` con el estado indicado. */
  function run(statusCode: number) {
    let onFinish = () => {};
    const res = {
      statusCode,
      on: (_event: string, cb: () => void) => {
        onFinish = cb;
      },
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    requestLogger({ method: 'GET', originalUrl: '/x' } as Request, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    onFinish();
  }

  it('registra con nivel log las respuestas correctas', () => {
    run(200);
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/^GET \/x 200 \d+ms$/),
    );
  });

  it('usa warn para 4xx y error para 5xx', () => {
    run(404);
    run(500);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
  });
});

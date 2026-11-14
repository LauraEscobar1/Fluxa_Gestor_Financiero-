import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

/** Formato único de error que devuelve la API. */
export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/** Traducción de códigos SQLSTATE de Postgres a respuestas HTTP genéricas. */
const PG_ERRORS: Record<string, { status: number; message: string }> = {
  '23505': {
    status: HttpStatus.CONFLICT,
    message: 'Ya existe un registro con esos datos',
  },
  '23503': {
    status: HttpStatus.CONFLICT,
    message: 'La operación viola una relación con otro registro',
  },
  '23502': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Falta un dato obligatorio',
  },
  '22P02': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Formato de dato inválido',
  },
  '22003': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Valor numérico fuera de rango',
  },
};

/**
 * Filtro global que unifica todas las respuestas de error. Los errores
 * inesperados nunca exponen detalles al cliente; solo se registran en el log.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno del servidor';
    let extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else {
        const {
          message: m,
          statusCode: _s,
          error: _e,
          ...rest
        } = res as Record<string, unknown>;
        message = (m as string | string[] | undefined) ?? exception.message;
        extra = rest;
      }
    } else if (exception instanceof QueryFailedError) {
      const code = (
        exception as QueryFailedError & { driverError?: { code?: string } }
      ).driverError?.code;
      const mapped = code ? PG_ERRORS[code] : undefined;
      if (mapped) {
        statusCode = mapped.status;
        message = mapped.message;
      } else {
        this.logUnexpected(exception);
      }
    } else {
      this.logUnexpected(exception);
    }

    const body: ErrorBody = {
      ...extra,
      statusCode,
      error: HttpStatus[statusCode] ?? 'Error',
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    } as ErrorBody;

    response.status(statusCode).json(body);
  }

  private logUnexpected(exception: unknown): void {
    const err = exception as Error;
    this.logger.error(err?.message ?? String(exception), err?.stack);
  }
}

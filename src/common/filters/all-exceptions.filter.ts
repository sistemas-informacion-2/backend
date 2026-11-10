import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ url: string }>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttpException) {
      const error = exception instanceof Error ? exception.stack ?? exception.message : String(exception);
      this.logger.error(`${request.url}: ${error}`);
    }

    const exceptionResponse = isHttpException ? exception.getResponse() : null;
    const message =
      exceptionResponse && typeof exceptionResponse === 'object' && 'message' in exceptionResponse
        ? (exceptionResponse as { message: string | string[] }).message
        : isHttpException
          ? exception.message
          : 'Error interno del servidor';

    const error =
      exceptionResponse && typeof exceptionResponse === 'object' && 'error' in exceptionResponse
        ? (exceptionResponse as { error: string }).error
        : HttpStatus[statusCode];

    // Campos extra de la excepcion (p. ej. codigo_error e items_afectados del 409 de RF-SYNC-01) se conservan
    // para que el cliente pueda resolver el error; statusCode/message/error siempre salen con la forma de siempre.
    const extra =
      exceptionResponse && typeof exceptionResponse === 'object'
        ? Object.fromEntries(Object.entries(exceptionResponse).filter(([clave]) => !['statusCode', 'message', 'error'].includes(clave)))
        : {};

    response.status(statusCode).json({
      ...extra,
      statusCode,
      message: Array.isArray(message) ? message : [message],
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  message: string;
  error?: string;
  timestamp: string;
  path: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const timestamp = new Date().toISOString();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorName: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();
      if (typeof responseBody === 'string') {
        message = responseBody;
      } else if (typeof responseBody === 'object' && responseBody !== null) {
        const body = responseBody as Record<string, unknown>;
        const extractedMessage = body.message;
        if (Array.isArray(extractedMessage)) {
          message = extractedMessage.join(', ');
        } else if (typeof extractedMessage === 'string') {
          message = extractedMessage;
        }
        if (typeof body.error === 'string') {
          errorName = body.error;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      errorName = exception.name;
    }

    const payload: ErrorResponseBody = {
      statusCode: status,
      message,
      error: errorName,
      timestamp,
      path: request.originalUrl ?? request.url,
    };

    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(
      `${request.method} ${payload.path} ${status} :: ${payload.message}`,
      stack,
    );

    response.status(status).json(payload);
  }
}

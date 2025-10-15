import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl } = request;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<Response>();
        const status = response.statusCode;
        const duration = Date.now() - startedAt;
        this.logger.log(`${method} ${originalUrl} ${status} +${duration}ms`);
      }),
      catchError((error: unknown) => {
        const response = context.switchToHttp().getResponse<Response>();
        const status =
          response?.statusCode ?? (typeof (error as any)?.status === 'number' ? (error as any).status : 500);
        const duration = Date.now() - startedAt;
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        this.logger.error(`${method} ${originalUrl} ${status} +${duration}ms :: ${message}`, stack);
        return throwError(() => error);
      }),
    );
  }
}

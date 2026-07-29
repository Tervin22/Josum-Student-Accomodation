import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SafeExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttpException ? exception.getResponse() : undefined;
    const message = this.safeMessage(status, payload);
    const requestId = (request as Request & { requestId?: string }).requestId;

    if (status >= 500) {
      this.logger.error(
        `${requestId ?? 'unknown'} ${request.method} ${request.path} failed with ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN || status === HttpStatus.TOO_MANY_REQUESTS) {
      this.logger.warn(`${requestId ?? 'unknown'} ${request.method} ${request.path} returned ${status}`);
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: HttpStatus[status] ?? 'Error',
      timestamp: new Date().toISOString(),
      path: request.path,
      requestId,
    });
  }

  private safeMessage(status: number, payload: unknown) {
    if (status >= 500) {
      return 'An unexpected error occurred. Please try again later.';
    }
    if (typeof payload === 'string') return payload;
    if (payload && typeof payload === 'object' && 'message' in payload) {
      const message = (payload as { message?: unknown }).message;
      if (Array.isArray(message)) return message;
      if (typeof message === 'string') return message;
    }
    return 'Request could not be completed.';
  }
}

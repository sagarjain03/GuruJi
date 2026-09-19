import { randomUUID } from 'node:crypto'
import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { AppError } from '../app-error'

interface ErrorBody {
  error: {
    code: string
    message: string
    details: unknown
    requestId: string
  }
}

/** Every error leaves through here, in the shape documented in docs/api.md. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const request = http.getRequest<Request>()
    const response = http.getResponse<Response>()
    const requestId = (request.id as string | undefined) ?? randomUUID()

    const { status, body } = this.describe(exception, requestId)

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // The detail stays in the log, tied to requestId. The client gets none of it.
      this.logger.error({ requestId, err: exception }, 'Unhandled exception')
    }

    response.status(status).json(body)
  }

  private describe(exception: unknown, requestId: string): { status: number; body: ErrorBody } {
    if (exception instanceof AppError) {
      return {
        status: exception.getStatus(),
        body: {
          error: {
            code: exception.code,
            message: exception.message,
            details: exception.details,
            requestId,
          },
        },
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const payload = exception.getResponse()
      const details =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? (payload as { message: unknown }).message
          : null

      return {
        status,
        body: {
          error: {
            code: codeForStatus(status),
            message: exception.message,
            details,
            requestId,
          },
        },
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong.',
          details: null,
          requestId,
        },
      },
    }
  }
}

function codeForStatus(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'VALIDATION_FAILED'
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED'
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN'
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND'
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED'
    default:
      return 'INTERNAL_ERROR'
  }
}

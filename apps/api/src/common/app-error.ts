import { HttpException, HttpStatus } from '@nestjs/common'

/**
 * An error the client is allowed to branch on.
 *
 * `code` is the stable machine-readable string from docs/api.md. Anything that
 * is not an `AppError` is treated as internal and never reaches the client in
 * detail.
 */
export class AppError extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly details: unknown = null,
  ) {
    super(message, status)
  }
}

export class NotFoundError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, HttpStatus.NOT_FOUND)
  }
}

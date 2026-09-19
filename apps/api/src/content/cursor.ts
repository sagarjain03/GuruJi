import { HttpStatus } from '@nestjs/common'
import { AppError } from '../common/app-error'

export interface ListCursor {
  createdAt: string
  id: string
}

/**
 * Cursor encoding for keyset pagination.
 *
 * Base64url of the last row's sort key. It is opaque to the client on purpose:
 * a readable cursor invites clients to construct one, and then the server can
 * never change how the list is ordered.
 *
 * `createdAt` alone is not unique — the seed inserts a dozen problems inside the
 * same millisecond — so the id is the tiebreaker, and both must appear in the
 * ORDER BY for the page boundary to be stable.
 */
export function encodeCursor(cursor: ListCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

export function decodeCursor(raw: string): ListCursor {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
  } catch {
    throw invalidCursor()
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as ListCursor).createdAt !== 'string' ||
    typeof (parsed as ListCursor).id !== 'string' ||
    Number.isNaN(Date.parse((parsed as ListCursor).createdAt))
  ) {
    throw invalidCursor()
  }

  return parsed as ListCursor
}

function invalidCursor(): AppError {
  return new AppError(
    'INVALID_CURSOR',
    'That page cursor is not valid. Start from the first page.',
    HttpStatus.BAD_REQUEST,
  )
}

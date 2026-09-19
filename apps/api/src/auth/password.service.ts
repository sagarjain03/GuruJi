import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import argon2, { type HashOptions } from 'argon2'
import type { Env } from '../config/env'

/**
 * Argon2id, with the cost parameters from docs/security.md.
 *
 * Parallelism is 1 deliberately: the API is I/O bound and running one hash on
 * several threads costs latency for every other request in flight.
 */
@Injectable()
export class PasswordService {
  private readonly options: HashOptions

  constructor(config: ConfigService<Env, true>) {
    this.options = {
      type: argon2.argon2id,
      memoryCost: config.get('ARGON2_MEMORY_COST', { infer: true }),
      timeCost: config.get('ARGON2_TIME_COST', { infer: true }),
      parallelism: 1,
    }
  }

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options)
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain)
    } catch {
      // A malformed hash in the database is not a reason to 500 the login route.
      return false
    }
  }
}

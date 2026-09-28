import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomBytes } from 'node:crypto'
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
  private dummy: Promise<string> | null = null

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

  /**
   * A hash of a random secret at the configured cost, made once. Verifying an
   * unknown account against it costs exactly what a real verification costs,
   * so login takes as long for an email that does not exist.
   */
  unknownAccountHash(): Promise<string> {
    this.dummy ??= this.hash(randomBytes(32).toString('hex'))
    return this.dummy
  }

  /** Always false; spends the time a real verification would. */
  async verifyAgainstUnknownAccount(plain: string): Promise<false> {
    await this.verify(await this.unknownAccountHash(), plain)
    return false
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

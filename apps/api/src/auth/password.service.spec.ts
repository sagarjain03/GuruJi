import { ConfigService } from '@nestjs/config'
import { PasswordService } from './password.service'
import type { Env } from '../config/env'

function serviceWith(memoryCost = 19456, timeCost = 2): PasswordService {
  const config = {
    get: (key: keyof Env) => (key === 'ARGON2_MEMORY_COST' ? memoryCost : timeCost),
  } as unknown as ConfigService<Env, true>
  return new PasswordService(config)
}

describe('PasswordService', () => {
  const service = serviceWith()

  it('produces an argon2id hash, not the plaintext', async () => {
    const hash = await service.hash('a-long-enough-password')

    expect(hash).toMatch(/^\$argon2id\$/)
    expect(hash).not.toContain('a-long-enough-password')
  })

  it('salts: the same password hashes differently every time', async () => {
    const [first, second] = await Promise.all([
      service.hash('same-password-123'),
      service.hash('same-password-123'),
    ])

    expect(first).not.toEqual(second)
  })

  it('verifies the correct password', async () => {
    const hash = await service.hash('correct-horse-battery')

    await expect(service.verify(hash, 'correct-horse-battery')).resolves.toBe(true)
  })

  it('rejects the wrong password', async () => {
    const hash = await service.hash('correct-horse-battery')

    await expect(service.verify(hash, 'correct-horse-batteryX')).resolves.toBe(false)
  })

  it('returns false for a malformed hash instead of throwing', async () => {
    await expect(service.verify('not-a-hash', 'anything')).resolves.toBe(false)
  })

  it('uses the configured cost parameters', async () => {
    const hash = await serviceWith(19456, 2).hash('cost-check-password')

    expect(hash).toContain('m=19456')
    expect(hash).toContain('t=2')
    expect(hash).toContain('p=1')
  })

  it('spends a real verification on an unknown account, at the configured cost', async () => {
    // The login route verifies against this when the email does not exist, so
    // "no such account" takes as long as "wrong password". A hash hard-coded at
    // one cost would drift the moment ARGON2_* changed, and the timing would
    // tell an attacker which emails are registered.
    const cheap = serviceWith(1024, 1)

    await expect(cheap.verifyAgainstUnknownAccount('any-password-at-all')).resolves.toBe(false)
    // Parameter order in the encoded hash is the library's business; the costs are ours.
    const params = (await cheap.unknownAccountHash()).split('$')[3]?.split(',') ?? []
    expect(params).toEqual(expect.arrayContaining(['m=1024', 't=1']))
  })
})

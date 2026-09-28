import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { ErrorEnvelope } from '@guruji/types'
import request from 'supertest'
import { vi } from 'vitest'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/app-setup'

// Hoisted above the imports by vitest, so it runs before the config is read:
// a small limit, and the test need not send a hundred requests to see one refused.
vi.hoisted(() => {
  process.env.RATE_LIMIT_GLOBAL_PER_MINUTE = '5'
})

/**
 * The baseline limit per IP (docs/security.md): every route, signed in or
 * not, before any route-specific limit. Expensive routes keep their own,
 * stricter, per-user limits on top.
 */
describe('global rate limit (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = configureApp(moduleRef.createNestApplication())
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('refuses the request past the per-IP limit with RATE_LIMITED', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer()).get('/api/topics').expect(200)
    }

    const refused = await request(app.getHttpServer()).get('/api/topics').expect(429)
    expect((refused.body as ErrorEnvelope).error.code).toBe('RATE_LIMITED')
  })

  it('never limits the health check — a load balancer must always be answered', async () => {
    for (let i = 0; i < 8; i++) {
      await request(app.getHttpServer()).get('/api/health').expect(200)
    }
  })
})

import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { prisma } from '@guruji/database'
import { DRAFT_CODE_MAX, type Draft, type DraftsResponse } from '@guruji/types'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/app-setup'

const PASSWORD = 'a-long-enough-password'
const SLUG = 'pair-sums-to-target'

describe('drafts (e2e)', () => {
  let app: INestApplication
  let token: string
  let otherToken: string
  let email: string
  let otherEmail: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = configureApp(moduleRef.createNestApplication())
    await app.init()

    email = `draft-${randomUUID()}@example.com`
    otherEmail = `draft-${randomUUID()}@example.com`
    token = await register(email)
    otherToken = await register(otherEmail)
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [email, otherEmail] } } })
    await app.close()
  })

  async function register(address: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: address, password: PASSWORD, displayName: 'Draft Tester' })
      .expect(201)
    return response.body.accessToken as string
  }

  function save(bearer: string, language: string, code: string): request.Test {
    return request(app.getHttpServer())
      .put(`/api/problems/${SLUG}/drafts/${language}`)
      .set('authorization', `Bearer ${bearer}`)
      .send({ code })
  }

  function load(bearer: string): request.Test {
    return request(app.getHttpServer())
      .get(`/api/problems/${SLUG}/drafts`)
      .set('authorization', `Bearer ${bearer}`)
  }

  /* ---------------------------------------------------------------------- */

  it('gives back exactly what was saved — the server half of "survives a reload"', async () => {
    const code = '#include <bits/stdc++.h>\nint main() { return 0; }\n'
    const saved = (await save(token, 'CPP', code).expect(200)).body as Draft

    expect(saved.code).toBe(code)
    expect(saved.language).toBe('CPP')

    // A fresh request, as a reloaded page would make.
    const loaded = (await load(token).expect(200)).body as DraftsResponse
    expect(loaded.drafts.find((d) => d.language === 'CPP')?.code).toBe(code)
  })

  it('keeps one draft per language — switching does not destroy the other', async () => {
    await save(token, 'CPP', 'cpp attempt').expect(200)
    await save(token, 'PYTHON', 'python attempt').expect(200)
    await save(token, 'JAVASCRIPT', 'js attempt').expect(200)

    const { drafts } = (await load(token).expect(200)).body as DraftsResponse
    const byLanguage = Object.fromEntries(drafts.map((d) => [d.language, d.code]))

    expect(byLanguage.CPP).toBe('cpp attempt')
    expect(byLanguage.PYTHON).toBe('python attempt')
    expect(byLanguage.JAVASCRIPT).toBe('js attempt')
  })

  it('updates in place rather than accumulating rows', async () => {
    await save(token, 'C', 'first').expect(200)
    await save(token, 'C', 'second').expect(200)
    await save(token, 'C', 'third').expect(200)

    const { drafts } = (await load(token).expect(200)).body as DraftsResponse
    const forC = drafts.filter((d) => d.language === 'C')

    expect(forC).toHaveLength(1)
    expect(forC[0]?.code).toBe('third')
  })

  it('accepts an empty draft — clearing the editor is a real edit', async () => {
    await save(token, 'PYTHON', '').expect(200)
    const { drafts } = (await load(token).expect(200)).body as DraftsResponse
    expect(drafts.find((d) => d.language === 'PYTHON')?.code).toBe('')
  })

  /* ---------------------------------------------------------------------- */

  it('shows nobody else their drafts', async () => {
    await save(token, 'CPP', 'my private attempt').expect(200)

    const { drafts } = (await load(otherToken).expect(200)).body as DraftsResponse
    expect(drafts.map((d) => d.code)).not.toContain('my private attempt')
  })

  it('refuses an unauthenticated caller', async () => {
    await request(app.getHttpServer()).get(`/api/problems/${SLUG}/drafts`).expect(401)
    await request(app.getHttpServer())
      .put(`/api/problems/${SLUG}/drafts/CPP`)
      .send({ code: 'x' })
      .expect(401)
  })

  it('refuses a language it does not run', async () => {
    await save(token, 'RUST', 'fn main() {}').expect(400)
  })

  it('refuses a draft larger than the column is meant to hold', async () => {
    await save(token, 'CPP', 'x'.repeat(DRAFT_CODE_MAX + 1)).expect(400)
  })

  it('refuses a field the endpoint does not define', async () => {
    await request(app.getHttpServer())
      .put(`/api/problems/${SLUG}/drafts/CPP`)
      .set('authorization', `Bearer ${token}`)
      // A body naming its own userId must not be a way to write someone else's
      // draft — it is rejected outright rather than ignored.
      .send({ code: 'x', userId: randomUUID() })
      .expect(400)
  })

  it('answers a draft against a problem that does not exist', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/problems/no-such-problem/drafts')
      .set('authorization', `Bearer ${token}`)
      .expect(404)
    expect(response.body.error.code).toBe('PROBLEM_NOT_FOUND')
  })
})

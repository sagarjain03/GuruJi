import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { prisma } from '@guruji/database'
import request from 'supertest'
import { AI_PROVIDER } from '../src/ai/ai.service'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/app-setup'

const SLUG = 'pair-sums-to-target'

/**
 * The mentor history: everything the mentor has told someone, newest first,
 * and only theirs. The provider answers an explanation and fails everything
 * else, so a failed call can be shown to leave nothing behind.
 */
describe('mentor history (e2e)', () => {
  let app: INestApplication
  const emails: string[] = []

  const EXPLANATION = {
    intuition: 'Remember what you have seen.',
    example: '[2, 7] with target 9.',
    implementation: 'One pass with a map.',
    complexity: 'O(n) time.',
    commonMistakes: ['Pairing an element with itself.'],
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AI_PROVIDER)
      .useValue({
        complete: async (req: { messages: { content: string }[] }) => {
          if (req.messages.some((message) => message.content.includes('Explain intuition'))) {
            return { content: JSON.stringify(EXPLANATION), usage: null }
          }
          throw new Error('provider down')
        },
        completeStructured: async () => {
          throw new Error('provider down')
        },
      })
      .compile()
    app = configureApp(moduleRef.createNestApplication())
    await app.init()
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
    await app.close()
  })

  async function signUp(): Promise<string> {
    const email = `mentor-history-${randomUUID()}@example.com`
    emails.push(email)
    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'a-long-enough-password', displayName: 'History Tester' })
      .expect(201)
    return registered.body.accessToken as string
  }

  const history = (token: string) =>
    request(app.getHttpServer()).get('/api/ai/history').set('authorization', `Bearer ${token}`)

  it('needs a session', async () => {
    await request(app.getHttpServer()).get('/api/ai/history').expect(401)
  })

  it('is empty for someone who has not asked yet', async () => {
    const token = await signUp()
    const response = await history(token).expect(200)
    expect(response.body).toEqual({ entries: [] })
  })

  it('lists every answer newest first, with its problem, and skips failed calls', async () => {
    const token = await signUp()
    const ask = (path: string, body: object, status: number) =>
      request(app.getHttpServer()).post(`/api/ai/${path}`).set('authorization', `Bearer ${token}`).send(body).expect(status)

    await ask('hint', { problemSlug: SLUG, level: 1 }, 201) // curated: no model involved
    await ask('explain', { problemSlug: SLUG }, 201)
    await ask('analyze-code', { problemSlug: SLUG, code: 'print(1)' }, 503) // provider fails

    const { body } = await history(token).expect(200)
    expect(body.entries.map((entry: { mode: string }) => entry.mode)).toEqual(['EXPLAIN', 'HINT'])

    const [explain, hint] = body.entries
    expect(explain.problem).toEqual({ slug: SLUG, title: 'Pair Sums to Target' })
    expect(explain.sections[0]).toEqual({ title: 'Intuition', text: EXPLANATION.intuition })
    expect(explain.code).toBeNull()
    expect(hint.hintLevel).toBe(1)
    expect(hint.sections[0].title).toBe('Hint')
  })

  it('never shows one person another’s history', async () => {
    const mine = await signUp()
    await request(app.getHttpServer())
      .post('/api/ai/hint')
      .set('authorization', `Bearer ${mine}`)
      .send({ problemSlug: SLUG, level: 1 })
      .expect(201)

    const theirs = await signUp()
    const response = await history(theirs).expect(200)
    expect(response.body.entries).toEqual([])
  })
})

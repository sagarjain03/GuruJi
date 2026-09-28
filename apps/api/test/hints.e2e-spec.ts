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
 * What a submission records as "hints used".
 *
 * The mastery model reads `hintsUsedAtSubmit` as the hint *level reached*
 * (`hintWeight` indexes its weights by it), and the dashboard sums it. So the
 * number has to be the highest level the person was actually shown — not a
 * count of requests, which a repeated ask or a failed call would inflate.
 *
 * Levels 1–3 are curated for this problem and never reach a model. Level 4
 * does, and the provider here always fails, so no test depends on a live AI.
 */
describe('hints used at submit (e2e)', () => {
  let app: INestApplication
  let token: string
  let email: string
  let userId: string
  let problemId: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AI_PROVIDER)
      .useValue({
        complete: async () => {
          throw new Error('provider down')
        },
        completeStructured: async () => {
          throw new Error('provider down')
        },
      })
      .compile()
    app = configureApp(moduleRef.createNestApplication())
    await app.init()

    email = `hints-${randomUUID()}@example.com`
    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'a-long-enough-password', displayName: 'Hint Tester' })
      .expect(201)
    token = registered.body.accessToken as string
    ;({ id: userId } = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } }))
    ;({ id: problemId } = await prisma.problem.findFirstOrThrow({ where: { slug: SLUG }, select: { id: true } }))
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } })
    await app.close()
  })

  const hint = (level: number) =>
    request(app.getHttpServer())
      .post('/api/ai/hint')
      .set('authorization', `Bearer ${token}`)
      .send({ problemSlug: SLUG, level })

  async function submitAndReadHints(): Promise<number> {
    const response = await request(app.getHttpServer())
      .post('/api/submissions')
      .set('authorization', `Bearer ${token}`)
      .send({ problemId, language: 'PYTHON', code: 'print(-1)\n', isRun: false })
      .expect(202)
    const row = await prisma.submission.findUniqueOrThrow({
      where: { id: response.body.id as string },
      select: { hintsUsedAtSubmit: true },
    })
    return row.hintsUsedAtSubmit
  }

  it('records nothing before any hint is asked for', async () => {
    expect(await submitAndReadHints()).toBe(0)
  })

  it('records the highest level shown, not how many times it was asked', async () => {
    await hint(1).expect(201)
    await hint(1).expect(201)
    await hint(2).expect(201)

    // Level 1 twice and level 2 once is "reached level 2", not three hints.
    expect(await submitAndReadHints()).toBe(2)
  })

  describe('input caps on the mentor', () => {
    // Everything here is sent to a paid model. docs/security.md caps a message
    // at 4 KB: past that it is context flooding, and every character is a cost.
    const TOO_LONG = 'x'.repeat(4001)
    const post = (path: string, body: object) =>
      request(app.getHttpServer()).post(`/api/ai/${path}`).set('authorization', `Bearer ${token}`).send(body)

    it('accepts a message at exactly the cap', async () => {
      // Level 1 is curated, so this reaches no model and succeeds.
      await post('hint', { problemSlug: SLUG, level: 1, message: 'x'.repeat(4000) }).expect(201)
    })

    it.each([
      ['hint', { problemSlug: SLUG, level: 1, message: TOO_LONG }],
      ['explain', { problemSlug: SLUG, question: TOO_LONG }],
      ['show-solution', { problemSlug: SLUG, question: TOO_LONG }],
      ['explain-wrong-answer', { problemSlug: SLUG, code: 'x', failedInput: TOO_LONG, expectedOutput: '', actualOutput: '' }],
      ['explain-wrong-answer', { problemSlug: SLUG, code: 'x', failedInput: '', expectedOutput: TOO_LONG, actualOutput: '' }],
      ['explain-wrong-answer', { problemSlug: SLUG, code: 'x', failedInput: '', expectedOutput: '', actualOutput: TOO_LONG }],
    ])('refuses a %s field over 4 KB before it reaches the model', async (path, body) => {
      await post(path, body).expect(400)
    })

    it('still takes code up to the submission cap, and refuses more', async () => {
      // Code is code, not a message: its cap is the 64 KB a submission may be.
      await post('analyze-code', { problemSlug: SLUG, code: 'x'.repeat(64 * 1024 + 1) }).expect(400)
    })
  })

  it('does not count a hint the mentor failed to give', async () => {
    await hint(4).expect(503)

    // The failure is still logged — just without a level, because nothing was shown.
    const failed = await prisma.aIMessage.findFirstOrThrow({
      where: { conversation: { userId, problemId }, mode: 'HINT', content: 'AI provider unavailable.' },
      select: { hintLevel: true },
    })
    expect(failed.hintLevel).toBeNull()
    expect(await submitAndReadHints()).toBe(2)
  })
})

import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { prisma } from '@guruji/database'
import request from 'supertest'
import type Redis from 'ioredis'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/app-setup'
import { REDIS } from '../src/redis/redis.module'

const REFRESH_COOKIE = 'guruji_refresh'
const PASSWORD = 'a-long-enough-password'

function setCookies(response: request.Response): string[] {
  return (response.headers['set-cookie'] as unknown as string[] | undefined) ?? []
}

function refreshCookieFrom(response: request.Response): string {
  const cookie = setCookies(response).find((value) => value.startsWith(`${REFRESH_COOKIE}=`))
  if (!cookie) {
    throw new Error('No refresh cookie on the response.')
  }
  return cookie.split(';')[0] as string
}

describe('auth (e2e)', () => {
  let app: INestApplication
  let redis: Redis
  let email: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = configureApp(moduleRef.createNestApplication())
    await app.init()
    redis = app.get<Redis>(REDIS)
  })

  beforeEach(async () => {
    email = `e2e-${randomUUID()}@example.com`
    // Attempts are counted per IP as well as per email, so repeated local runs
    // would otherwise trip the limiter on the fifth run rather than the fifth
    // attempt.
    const keys = await redis.keys('rl:*')
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  })

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { email } })
  })

  afterAll(async () => {
    await app.close()
  })

  it('runs a whole session: register, login, refresh, protected route, logout', async () => {
    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, displayName: 'E2E User' })
      .expect(201)

    expect(registered.body.accessToken).toEqual(expect.any(String))
    expect(registered.body.user.email).toBe(email)
    expect(registered.body.profile.displayName).toBe('E2E User')
    // The refresh token must never be readable from JavaScript, and the password
    // hash must never leave the database.
    const serialised = JSON.stringify(registered.body)
    expect(serialised).not.toContain('refreshToken')
    expect(serialised).not.toContain('passwordHash')
    expect(serialised).not.toContain('$argon2')

    const rawCookie = setCookies(registered)[0] as string
    expect(rawCookie).toContain('HttpOnly')
    expect(rawCookie).toContain('SameSite=Strict')

    const loggedIn = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200)

    const loginCookie = refreshCookieFrom(loggedIn)

    const refreshed = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', loginCookie)
      .expect(200)

    expect(refreshed.body.accessToken).toEqual(expect.any(String))
    expect(refreshCookieFrom(refreshed)).not.toBe(loginCookie)

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${refreshed.body.accessToken as string}`)
      .expect(200)

    expect(me.body.user.email).toBe(email)

    const lastCookie = refreshCookieFrom(refreshed)

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', lastCookie)
      .expect(204)

    // A revoked token must not buy a new session.
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', lastCookie)
      .expect(401)
  })

  it('revokes the whole chain when a rotated token is replayed', async () => {
    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, displayName: 'Replay Victim' })
      .expect(201)

    const first = refreshCookieFrom(registered)

    const rotated = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', first)
      .expect(200)

    const second = refreshCookieFrom(rotated)

    // Replaying the already-rotated token is treated as theft.
    await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', first).expect(401)

    // ...and the live token from the legitimate session dies with it.
    await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', second).expect(401)

    const live = await prisma.refreshToken.count({
      where: { user: { email }, revokedAt: null },
    })
    expect(live).toBe(0)
  })

  it('gives the same answer for an unknown email and a wrong password', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, displayName: 'Enumeration Target' })
      .expect(201)

    const wrongPassword = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'wrong-password-here' })
      .expect(401)

    const unknownEmail = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: `missing-${randomUUID()}@example.com`, password: PASSWORD })
      .expect(401)

    expect(wrongPassword.body.error.code).toBe(unknownEmail.body.error.code)
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message)
  })

  it('refuses a short password and an unknown field', async () => {
    const short = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'tooshort', displayName: 'X' })
      .expect(400)

    expect(short.body.error.requestId).toEqual(expect.any(String))

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, displayName: 'X', role: 'ADMIN' })
      .expect(400)
  })

  it('rejects a second registration of the same email', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, displayName: 'First' })
      .expect(201)

    const conflict = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, displayName: 'Second' })
      .expect(409)

    expect(conflict.body.error.code).toBe('EMAIL_ALREADY_REGISTERED')
  })

  it('blocks the sixth login attempt in the window', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, displayName: 'Brute Force Target' })
      .expect(201)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'not-the-password' })
        .expect(401)
    }

    // The sixth is refused even though the password is correct.
    const blocked = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(429)

    expect(blocked.body.error.code).toBe('RATE_LIMITED')
  })

  it('clears the cookie when the refresh token cannot be exchanged', async () => {
    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, displayName: 'Stale Cookie' })
      .expect(201)

    const cookie = refreshCookieFrom(registered)
    await prisma.user.deleteMany({ where: { email } })

    const rejected = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .expect(401)

    // Otherwise the browser keeps looking signed in to anything that only
    // checks whether a cookie exists, and bounces between login and dashboard.
    const cleared = setCookies(rejected).find((value) =>
      value.startsWith(`${REFRESH_COOKIE}=;`),
    )
    expect(cleared).toBeDefined()
  })

  it('requires a valid token on the protected route', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401)
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401)
  })
})

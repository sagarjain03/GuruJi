import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { parseOrigins, type Env } from './config/env'

/**
 * How large a runner callback is allowed to be.
 *
 * Express defaults every route to 100 KB, and a legitimate callback blows past
 * that on its second test case: the contract caps output at 64 KB *per case*
 * plus another 64 KB of compiler output. The oversized body is rejected before
 * any handler sees it, which surfaces as a 500 — and BullMQ then retries it
 * three times and dead-letters the job, so a submission that ran perfectly well
 * is reported to the user as `INTERNAL_ERROR`.
 *
 * Raised only for that one route. The public routes keep the small default,
 * because a generous body limit in front of unauthenticated handlers is a
 * denial-of-service primitive, and `POST /submissions` is capped at 64 KB of
 * code anyway.
 */
const RUNNER_CALLBACK_BODY_LIMIT = '8mb'

/**
 * Everything else, including every unauthenticated route.
 *
 * Express's own default, kept deliberately: the largest thing a client sends is
 * 64 KB of code on `POST /submissions`, and a generous body limit in front of
 * handlers anyone can reach is a denial-of-service primitive rather than a
 * convenience.
 */
const PUBLIC_BODY_LIMIT = '100kb'

/**
 * Everything that turns a bare Nest application into *this* application.
 *
 * It lives here rather than in `main.ts` so the end-to-end suites exercise the
 * same prefix, pipes, filter and cookie handling that production runs — a test
 * against a differently configured app proves very little.
 */
export function configureApp(app: INestApplication): INestApplication {
  const config = app.get(ConfigService<Env, true>)

  const prefix = config.get('API_GLOBAL_PREFIX', { infer: true })

  app.setGlobalPrefix(prefix)
  app.use(helmet())
  app.use(cookieParser())

  /*
   * Body parsing, registered here rather than left to Nest.
   *
   * Nest adds its own parsers during `init()` — but only if it cannot already
   * find a middleware named `jsonParser` on the stack. Mounting one for a
   * single path therefore silently disables parsing for *every other route*,
   * and the whole API answers 400 with an empty body. That is not a thing to
   * discover twice, so both parsers are declared explicitly below and Nest's
   * detection finds what it expects.
   *
   * Order matters: the path-scoped parser runs first and claims the callback
   * body at the larger limit. `express.json` returns early on a request whose
   * body is already parsed, so the global one below leaves it alone.
   */
  app.use(
    `/${prefix}/internal/submissions/callback`,
    express.json({ limit: RUNNER_CALLBACK_BODY_LIMIT }),
  )
  app.use(express.json({ limit: PUBLIC_BODY_LIMIT }))
  app.use(express.urlencoded({ extended: true, limit: PUBLIC_BODY_LIMIT }))

  app.enableCors({
    origin: parseOrigins(config.get('CORS_ORIGINS', { infer: true })),
    credentials: true,
  })

  app.useGlobalPipes(
    new ValidationPipe({
      // Anything not on the DTO is dropped, and sending it is an error rather
      // than something the server silently ignores.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.useGlobalFilters(new AllExceptionsFilter())
  app.enableShutdownHooks()

  return app
}

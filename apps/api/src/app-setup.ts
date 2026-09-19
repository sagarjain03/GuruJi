import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { parseOrigins, type Env } from './config/env'

/**
 * Everything that turns a bare Nest application into *this* application.
 *
 * It lives here rather than in `main.ts` so the end-to-end suites exercise the
 * same prefix, pipes, filter and cookie handling that production runs — a test
 * against a differently configured app proves very little.
 */
export function configureApp(app: INestApplication): INestApplication {
  const config = app.get(ConfigService<Env, true>)

  app.setGlobalPrefix(config.get('API_GLOBAL_PREFIX', { infer: true }))
  app.use(helmet())
  app.use(cookieParser())

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

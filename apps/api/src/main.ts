import 'reflect-metadata'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module'
import { configureApp } from './app-setup'
import type { Env } from './config/env'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })

  app.useLogger(app.get(Logger))
  configureApp(app)

  const config = app.get(ConfigService<Env, true>)
  await app.listen(config.get('API_PORT', { infer: true }))
}

void bootstrap()

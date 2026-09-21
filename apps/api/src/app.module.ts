import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { LoggerModule } from 'nestjs-pino'
import { randomUUID } from 'node:crypto'
import { loadEnv } from './config/env'
import { AuthModule } from './auth/auth.module'
import { ContentModule } from './content/content.module'
import { EditorModule } from './editor/editor.module'
import { ExecutionModule } from './execution/execution.module'
import { MasteryModule } from './mastery/mastery.module'
import { HealthModule } from './health/health.module'
import { RealtimeModule } from './realtime/realtime.module'
import { RecommendationsModule } from './recommendations/recommendations.module'
import { RevisionModule } from './revision/revision.module'
import { RedisModule } from './redis/redis.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // One .env at the repo root; the API never keeps its own copy.
      envFilePath: ['../../.env'],
      validate: loadEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // Correlation id: reuse the caller's if it sent one, otherwise mint it.
        genReqId: (req, res) => {
          const existing = req.headers['x-request-id']
          const id = typeof existing === 'string' && existing.length > 0 ? existing : randomUUID()
          res.setHeader('x-request-id', id)
          return id
        },
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
          remove: true,
        },
        // Spread rather than `transport: undefined` — `exactOptionalPropertyTypes`
        // treats an explicit undefined as a different thing from absence.
        ...(process.env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
      },
    }),
    // Cron jobs. Only the nightly reconciliation so far, and it is scheduled in
    // UTC — a job on local time fires twice or not at all on the two days a
    // year the clocks move.
    ScheduleModule.forRoot(),
    RedisModule,
    AuthModule,
    ContentModule,
    EditorModule,
    ExecutionModule,
    MasteryModule,
    RevisionModule,
    RecommendationsModule,
    RealtimeModule,
    HealthModule,
  ],
})
export class AppModule {}

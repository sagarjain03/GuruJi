import { ConfigService } from '@nestjs/config'
import { Module } from '@nestjs/common'
import { GroqProvider, type LLMProvider } from '@guruji/ai'
import type { Env } from '../config/env'
import { AuthModule } from '../auth/auth.module'
import { ContentModule } from '../content/content.module'
import { AIController } from './ai.controller'
import { AI_PROVIDER, AI_REFERENCE_EXECUTOR, AIService, type ReferenceExecutor } from './ai.service'

@Module({
  imports: [AuthModule, ContentModule],
  controllers: [AIController],
  providers: [
    AIService,
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): LLMProvider => {
        const apiKey = config.get('GROQ_API_KEY', { infer: true })
        if (apiKey === undefined) {
          return {
            complete: async () => {
              throw new Error('GROQ_API_KEY is not configured.')
            },
            completeStructured: async () => {
              throw new Error('GROQ_API_KEY is not configured.')
            },
          }
        }
        return new GroqProvider({
          apiKey,
          fastModel: config.get('GROQ_FAST_MODEL', { infer: true }),
          qualityModel: config.get('GROQ_QUALITY_MODEL', { infer: true }),
        })
      },
    },
    {
      provide: AI_REFERENCE_EXECUTOR,
      useValue: {
        execute: async (): Promise<never> => {
          throw new Error('Reference execution must be provided by the code-runner service.')
        },
      } satisfies ReferenceExecutor,
    },
  ],
})
export class AIModule {}
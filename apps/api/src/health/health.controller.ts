import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common'
import type { Response } from 'express'
import { HealthService, type ReadinessReport } from './health.service'

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Liveness: the process is up. No dependencies, no internals. */
  @Get()
  @HttpCode(HttpStatus.OK)
  live(): { status: 'ok' } {
    return { status: 'ok' }
  }

  /** Readiness: the process can actually serve traffic. */
  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response): Promise<ReadinessReport> {
    const report = await this.health.readiness()
    response.status(report.status === 'ready' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
    return report
  }
}

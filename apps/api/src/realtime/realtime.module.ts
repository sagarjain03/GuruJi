import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { EventsGateway } from './events.gateway'

/**
 * The WebSocket surface, on its own so that the feature modules which push
 * events depend on a gateway rather than on each other.
 */
@Module({
  // For JwtService, which the handshake verification needs.
  imports: [AuthModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class RealtimeModule {}

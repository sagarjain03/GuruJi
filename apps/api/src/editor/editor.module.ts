import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { DraftsController } from './drafts.controller'
import { DraftsService } from './drafts.service'

/** Everything the code editor needs from the server. Drafts today; more in Phase 4. */
@Module({
  // For `AccessTokenGuard`, which AuthModule exports.
  imports: [AuthModule],
  controllers: [DraftsController],
  providers: [DraftsService],
})
export class EditorModule {}

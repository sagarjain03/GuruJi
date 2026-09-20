import { IsString, MaxLength } from 'class-validator'
import { DRAFT_CODE_MAX, type SaveDraftRequest } from '@guruji/types'

export class SaveDraftDto implements SaveDraftRequest {
  // An empty draft is legitimate — it is what clearing the editor means.
  @IsString()
  @MaxLength(DRAFT_CODE_MAX, { message: 'That is too much code to save.' })
  code!: string
}

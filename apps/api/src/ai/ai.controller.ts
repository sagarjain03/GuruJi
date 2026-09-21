import { Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user'
import { AccessTokenGuard, type AuthenticatedUser } from '../auth/guards/access-token.guard'
import { AIService } from './ai.service'
import { HintDto } from './dto/hint.dto'
import { AnalyzeCodeDto, ExplainDto, ExplainWrongAnswerDto } from './dto/mentor.dto'
import { GenerateProblemDto } from './dto/generate-problem.dto'

@Controller('ai')
@UseGuards(AccessTokenGuard)
export class AIController {
  constructor(private readonly ai: AIService) {}

  @Post('hint')
  hint(@CurrentUser() user: AuthenticatedUser, @Body() dto: HintDto) {
    return this.ai.hint(user.id, dto)
  }

  @Post('explain')
  explain(@CurrentUser() user: AuthenticatedUser, @Body() dto: ExplainDto) {
    return this.ai.explain(user.id, dto)
  }

  @Post('analyze-code')
  analyzeCode(@CurrentUser() user: AuthenticatedUser, @Body() dto: AnalyzeCodeDto) {
    return this.ai.analyzeCode(user.id, dto)
  }

  @Post('explain-wrong-answer')
  explainWrongAnswer(@CurrentUser() user: AuthenticatedUser, @Body() dto: ExplainWrongAnswerDto) {
    return this.ai.explainWrongAnswer(user.id, dto)
  }

  @Post('show-solution')
  showSolution(@CurrentUser() user: AuthenticatedUser, @Body() dto: ExplainDto) {
    return this.ai.showSolution(user.id, dto)
  }

  @Post('generate-problem')
  generateProblem(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateProblemDto) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required.')
    }
    return this.ai.generateProblem(user.id, dto)
  }
}
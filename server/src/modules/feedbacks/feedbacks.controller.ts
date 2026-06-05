import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { FeedbackService } from './services/feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { Feedback } from './entities/feedback.entity';
import { Match } from '@modules/matches/entities/match.entity';

/**
 * 赛后反馈控制器
 *
 * 提供反馈提交和待反馈比赛查询接口。
 */
@ApiTags('赛后反馈')
@Controller('feedbacks')
export class FeedbacksController {
  constructor(private readonly feedbackService: FeedbackService) {}

  /**
   * 提交赛后反馈
   */
  @Post()
  @ApiOperation({ summary: '提交赛后反馈' })
  @ApiResponse({
    status: 201,
    description: '反馈提交成功',
    type: Feedback,
  })
  @ApiResponse({
    status: 400,
    description: '请求参数错误（自评/评价非参赛球员等）',
  })
  @ApiResponse({ status: 404, description: '比赛不存在或球员未参赛' })
  @ApiResponse({
    status: 409,
    description: '比赛未结束/球员未确认/已提交过反馈',
  })
  async create(@Body() dto: CreateFeedbackDto): Promise<Feedback> {
    return this.feedbackService.createFeedback(dto);
  }

  /**
   * 查询某球员待反馈的比赛列表
   */
  @Get('pending/:playerId')
  @ApiOperation({ summary: '查询待反馈比赛列表' })
  @ApiParam({ name: 'playerId', description: '球员ID', type: Number })
  @ApiResponse({
    status: 200,
    description: '待反馈比赛列表',
    type: [Match],
  })
  async findPending(
    @Param('playerId', ParseIntPipe) playerId: number,
  ): Promise<Match[]> {
    return this.feedbackService.findPendingFeedbacks(playerId);
  }
}

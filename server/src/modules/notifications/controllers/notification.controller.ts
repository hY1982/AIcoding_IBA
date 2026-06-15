import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { NotificationService } from '../services/notification.service';
import { QueryNotificationDto } from '../dto/query-notification.dto';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';

/**
 * Notifications Controller
 *
 * 暴露通知相关 HTTP 端点，供前端查询和管理用户通知。
 */
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /notifications
   * 分页查询当前用户的通知列表
   */
  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryNotificationDto,
  ) {
    return this.notificationService.findByUser(user.userId, query);
  }

  /**
   * GET /notifications/unread-count
   * 获取当前用户未读通知数量
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    const count = await this.notificationService.getUnreadCount(user.userId);
    return { count };
  }

  /**
   * POST /notifications/:id/read
   * 标记单条通知为已读
   */
  @Post(':id/read')
  async markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationService.markAsRead(id, user.userId);
  }

  /**
   * POST /notifications/read-all
   * 标记全部通知为已读
   */
  @Post('read-all')
  async markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationService.markAllAsRead(user.userId);
  }
}

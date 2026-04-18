import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { UserJwtGuard } from '../../common/guards/user-jwt.guard';
import { NotificationService } from './notification.service';
import { ListNotificationsDto } from './dto/notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(UserJwtGuard)
@Controller('v1/notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  private userId(req: Request): string {
    const sub = req.user?.sub;
    if (!sub) throw new ForbiddenException('Unauthorized');
    return sub;
  }

  @Get()
  @ApiOperation({ summary: 'List the caller’s notifications' })
  @ApiResponse({ status: HttpStatus.OK })
  async list(@Req() req: Request, @Query() query: ListNotificationsDto) {
    return this.notifications.list(this.userId(req), {
      unreadOnly: query.unreadOnly,
      limit: query.limit,
      cursor: query.cursor ?? null,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count for the caller' })
  async unreadCount(@Req() req: Request) {
    const count = await this.notifications.unreadCount(this.userId(req));
    return { count };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a single notification as read' })
  async markRead(@Req() req: Request, @Param('id') id: string) {
    const row = await this.notifications.markRead(this.userId(req), id);
    if (!row) throw new NotFoundException('Notification not found');
    return row;
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark every unread notification as read' })
  async markAllRead(@Req() req: Request) {
    const updated = await this.notifications.markAllRead(this.userId(req));
    return { updated };
  }
}

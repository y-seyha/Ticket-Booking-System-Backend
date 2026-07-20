import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { CurrentUser } from '../authentication/decorators/current-user.decorator';
import { NotificationService } from './notification.service';
import {
  RegisterDeviceTokenDto,
  UnregisterDeviceTokenDto,
} from './dto/register-device-token.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register a device token for push notifications' })
  async registerToken(
    @CurrentUser() user: { id: string },
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    await this.notificationService.registerToken(
      user.id,
      dto.token,
      dto.platform,
    );
    return { message: 'Device token registered successfully' };
  }

  @Delete('unregister')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unregister a device token' })
  async unregisterToken(
    @CurrentUser() user: { id: string },
    @Body() dto: UnregisterDeviceTokenDto,
  ) {
    await this.notificationService.unregisterToken(user.id, dto.token);
    return { message: 'Device token unregistered successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'Get notification history for the current user' })
  async getHistory(
    @CurrentUser() user: { id: string },
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationService.getNotificationHistory(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser() user: { id: string }) {
    const count = await this.notificationService.getUnreadCount(user.id);
    return { count };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    await this.notificationService.markAsRead(user.id, id);
    return { message: 'Notification marked as read' };
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: { id: string }) {
    await this.notificationService.markAllAsRead(user.id);
    return { message: 'All notifications marked as read' };
  }
}

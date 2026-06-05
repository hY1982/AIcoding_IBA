import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationService } from './services/notification.service';
import { InAppChannel } from './channels/in-app.channel';
import { NOTIFICATION_CHANNEL_PROVIDER } from './interfaces/notification-channel.interface';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  providers: [
    NotificationService,
    InAppChannel,
    {
      provide: NOTIFICATION_CHANNEL_PROVIDER,
      useExisting: InAppChannel,
    },
  ],
  exports: [NotificationService, TypeOrmModule],
})
export class NotificationsModule {}

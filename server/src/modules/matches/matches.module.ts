import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match } from './entities/match.entity';
import { MatchPlayer } from './entities/match-player.entity';
import { MatchTeam } from './entities/match-team.entity';
import { MatchConfirmationService } from './services/match-confirmation.service';
import { MockGroupChatService } from './services/mock-group-chat.service';
import { GROUP_CHAT_PROVIDER } from './interfaces/group-chat-provider.interface';
import { PaymentsModule } from '@modules/payments/payments.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { Format } from '@modules/formats/entities/format.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Match,
      MatchPlayer,
      MatchTeam,
      VenueTimeSlot,
      Format,
    ]),
    PaymentsModule,
    NotificationsModule,
  ],
  providers: [
    MatchConfirmationService,
    MockGroupChatService,
    {
      provide: GROUP_CHAT_PROVIDER,
      useClass: MockGroupChatService,
    },
  ],
  exports: [MatchConfirmationService, TypeOrmModule],
})
export class MatchesModule {}

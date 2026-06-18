import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match } from './entities/match.entity';
import { MatchPlayer } from './entities/match-player.entity';
import { MatchTeam } from './entities/match-team.entity';
import { MatchConfirmationService } from './services/match-confirmation.service';
import { MatchQueryService } from './services/match-query.service';
import { MatchExpirationScheduler } from './match-expiration.scheduler';
import { MatchController } from './controllers/match.controller';
import { VenueBookingController } from './controllers/venue-booking.controller';
import { MockGroupChatService } from './services/mock-group-chat.service';
import { GROUP_CHAT_PROVIDER } from './interfaces/group-chat-provider.interface';
import { PaymentsModule } from '@modules/payments/payments.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { MessagesModule } from '@modules/messages/messages.module';
import { PlayersModule } from '@modules/players/players.module';
import { VenuesModule } from '@modules/venues/venues.module';
import { MatchingModule } from '@modules/matching/matching.module';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { VenueBookingRequest } from '@modules/venues/entities/venue-booking-request.entity';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { Format } from '@modules/formats/entities/format.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Match,
      MatchPlayer,
      MatchTeam,
      VenueTimeSlot,
      VenueBookingRequest,  // v2.0
      Intention,  // v2.0
      Format,
    ]),
    PaymentsModule,
    NotificationsModule,
    MessagesModule,
    PlayersModule,
    VenuesModule,  // v2.0: VenueBookingService
    MatchingModule,  // v2.0: TeamBalancerService
  ],
  controllers: [MatchController, VenueBookingController],
  providers: [
    MatchConfirmationService,
    MatchQueryService,
    MatchExpirationScheduler,
    MockGroupChatService,
    {
      provide: GROUP_CHAT_PROVIDER,
      useClass: MockGroupChatService,
    },
  ],
  exports: [MatchConfirmationService, MatchQueryService, TypeOrmModule],
})
export class MatchesModule {}

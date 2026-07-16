import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Venue } from './entities/venue.entity';
import { VenueTimeSlot } from './entities/venue-time-slot.entity';
import { VenueUnavailableSlot } from './entities/venue-unavailable-slot.entity';
import { VenueBookingRequest } from './entities/venue-booking-request.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { User } from '@modules/users/entities/user.entity';
import { VenueService } from './services/venue.service';
import { UnavailableSlotService } from './services/unavailable-slot.service';
import { VenueBookingService } from './services/venue-booking.service';
import { VenueManagerProfileService } from './services/venue-manager-profile.service';
import { VenueManagerProfileController } from './controllers/venue-manager-profile.controller';
import { VenueController } from './controllers/venue.controller';
import { NotificationsModule } from '@modules/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Venue, VenueTimeSlot, VenueUnavailableSlot, VenueBookingRequest, VenueManager, User]),
    NotificationsModule,
  ],
  providers: [VenueService, UnavailableSlotService, VenueBookingService, VenueManagerProfileService],
  controllers: [VenueManagerProfileController, VenueController],
  exports: [VenueService, UnavailableSlotService, VenueBookingService, VenueManagerProfileService, TypeOrmModule],
})
export class VenuesModule {}

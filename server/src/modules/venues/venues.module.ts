import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Venue } from './entities/venue.entity';
import { VenueTimeSlot } from './entities/venue-time-slot.entity';
import { VenueUnavailableSlot } from './entities/venue-unavailable-slot.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { User } from '@modules/users/entities/user.entity';
import { VenueService } from './services/venue.service';
import { UnavailableSlotService } from './services/unavailable-slot.service';
import { VenueManagerProfileService } from './services/venue-manager-profile.service';
import { VenueManagerProfileController } from './controllers/venue-manager-profile.controller';
import { VenueController } from './controllers/venue.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Venue, VenueTimeSlot, VenueUnavailableSlot, VenueManager, User])],
  providers: [VenueService, UnavailableSlotService, VenueManagerProfileService],
  controllers: [VenueManagerProfileController, VenueController],
  exports: [VenueService, UnavailableSlotService, TypeOrmModule],
})
export class VenuesModule {}

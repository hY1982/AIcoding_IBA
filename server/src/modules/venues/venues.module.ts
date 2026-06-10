import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Venue } from './entities/venue.entity';
import { VenueTimeSlot } from './entities/venue-time-slot.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { User } from '@modules/users/entities/user.entity';
import { VenueService } from './services/venue.service';
import { VenueManagerProfileService } from './services/venue-manager-profile.service';
import { VenueManagerProfileController } from './controllers/venue-manager-profile.controller';
import { VenueController } from './controllers/venue.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Venue, VenueTimeSlot, VenueManager, User])],
  providers: [VenueService, VenueManagerProfileService],
  controllers: [VenueManagerProfileController, VenueController],
  exports: [VenueService, TypeOrmModule],
})
export class VenuesModule {}

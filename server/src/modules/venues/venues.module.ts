import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Venue } from './entities/venue.entity';
import { VenueTimeSlot } from './entities/venue-time-slot.entity';
import { VenueService } from './services/venue.service';

@Module({
  imports: [TypeOrmModule.forFeature([Venue, VenueTimeSlot])],
  providers: [VenueService],
  exports: [VenueService, TypeOrmModule],
})
export class VenuesModule {}

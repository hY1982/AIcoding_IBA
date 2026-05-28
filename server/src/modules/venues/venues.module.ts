import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Venue } from './entities/venue.entity';
import { VenueTimeSlot } from './entities/venue-time-slot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Venue, VenueTimeSlot])],
  exports: [TypeOrmModule],
})
export class VenuesModule {}

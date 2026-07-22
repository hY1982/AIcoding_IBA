import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './controllers/admin.controller';
import { AdminService } from './services/admin.service';
import { AdminGuard } from './guards/admin.guard';
import { Player } from '@modules/players/entities/player.entity';
import { User } from '@modules/users/entities/user.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';

/**
 * Admin Module
 *
 * 管理后台模块，提供管理员专用的数据查询和配置接口。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Player,
      User,
      Venue,
      Match,
      Intention,
      VenueManager,
      SystemParam,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
  exports: [AdminService, AdminGuard],
})
export class AdminModule {}

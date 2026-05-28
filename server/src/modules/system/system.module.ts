import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemParam } from './entities/system-param.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SystemParam])],
  exports: [TypeOrmModule],
})
export class SystemModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Format } from './entities/format.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Format])],
  exports: [TypeOrmModule],
})
export class FormatsModule {}

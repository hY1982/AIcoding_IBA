import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Format } from './entities/format.entity';
import { FormatController } from './controllers/format.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Format])],
  controllers: [FormatController],
  exports: [TypeOrmModule],
})
export class FormatsModule {}

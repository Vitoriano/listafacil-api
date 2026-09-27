import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { GooglePlacesService } from './google-places.service';

@Module({
  imports: [ConfigModule],
  controllers: [StoresController],
  providers: [StoresService, GooglePlacesService],
  exports: [StoresService],
})
export class StoresModule {}

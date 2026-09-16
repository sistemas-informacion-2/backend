import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { SeedersModule } from './database/seeders/seeders.module.js';
import { CommonModule } from './common/common.module.js';
import { AccesoModule } from './modules/acceso/acceso.module.js';
import { OperacionesModule } from './modules/operaciones/operaciones.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    SeedersModule,
    CommonModule,
    OperacionesModule,
    AccesoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

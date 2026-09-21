import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration.js';
import { DatabaseModule } from './database/database.module.js';
import { SeedersModule } from './database/seeders/seeders.module.js';
import { CommonModule } from './common/common.module.js';
import { AccesoModule } from './modules/acceso/acceso.module.js';
import { OperacionesModule } from './modules/operaciones/operaciones.module.js';
import { InventarioModule } from './modules/inventario/inventario.module.js';
import { ComercialModule } from './modules/comercial/comercial.module.js';
import { ElectronicoModule } from './modules/electronico/electronico.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    SeedersModule,
    CommonModule,
    OperacionesModule,
    InventarioModule,
    ComercialModule,
    ElectronicoModule,
    AccesoModule,
  ],
})
export class AppModule {}

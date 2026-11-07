import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedersModule } from '../../database/seeders/seeders.module.js';
import { AccesoModule } from '../acceso/acceso.module.js';
import { ComercialModule } from '../comercial/comercial.module.js';
import { InventarioModule } from '../inventario/inventario.module.js';
import { Empresa } from './entities/empresa.entity.js';
import { EmpresasController } from './controllers/empresas.controller.js';
import { PlataformaAuthController } from './controllers/plataforma-auth.controller.js';
import { AprovisionamientoService } from './services/aprovisionamiento.service.js';
import { EmpresasService } from './services/empresas.service.js';

/** Plataforma SaaS: login del superadmin y alta/gestion de empresas (S4/S5). */
@Module({
  imports: [TypeOrmModule.forFeature([Empresa]), AccesoModule, SeedersModule, ComercialModule, InventarioModule],
  controllers: [PlataformaAuthController, EmpresasController],
  providers: [AprovisionamientoService, EmpresasService],
})
export class PlataformaModule {}

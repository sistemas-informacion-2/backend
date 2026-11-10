import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedersModule } from '../../database/seeders/seeders.module.js';
import { AccesoModule } from '../acceso/acceso.module.js';
import { Usuario } from '../acceso/entities/usuario.entity.js';
import { ComercialModule } from '../comercial/comercial.module.js';
import { ElectronicoModule } from '../electronico/electronico.module.js';
import { InventarioModule } from '../inventario/inventario.module.js';
import { Empresa } from './entities/empresa.entity.js';
import { PagoPlan } from './entities/pago-plan.entity.js';
import { Plan } from './entities/plan.entity.js';
import { EmpresasController } from './controllers/empresas.controller.js';
import { PlataformaAuthController } from './controllers/plataforma-auth.controller.js';
import { PortalController } from './controllers/portal.controller.js';
import { SuscripcionController } from './controllers/suscripcion.controller.js';
import { AprovisionamientoService } from './services/aprovisionamiento.service.js';
import { CobroPlanService } from './services/cobro-plan.service.js';
import { EmpresasService } from './services/empresas.service.js';
import { IngresoService } from './services/ingreso.service.js';
import { PlanesService } from './services/planes.service.js';
import { RegistroService } from './services/registro.service.js';
import { SuscripcionService } from './services/suscripcion.service.js';

/**
 * Plataforma SaaS DOMINATR: login del superadmin y gestion de empresas (S4/S5), y el portal publico con los
 * planes, el registro de empresas (prueba gratuita o pago con Stripe) y el login por correo; dentro de cada
 * tienda, Mi plan (renovar o cambiar de plan).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Empresa, Plan, PagoPlan, Usuario]),
    AccesoModule,
    SeedersModule,
    ComercialModule,
    InventarioModule,
    ElectronicoModule,
  ],
  controllers: [PlataformaAuthController, EmpresasController, PortalController, SuscripcionController],
  providers: [AprovisionamientoService, EmpresasService, PlanesService, CobroPlanService, RegistroService, SuscripcionService, IngresoService],
})
export class PlataformaModule {}

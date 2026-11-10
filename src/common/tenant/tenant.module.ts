import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClsModule } from 'nestjs-cls';
import { Empresa } from '../../modules/plataforma/entities/empresa.entity.js';
import { Plan } from '../../modules/plataforma/entities/plan.entity.js';
import { EmpresaResolver } from './empresa-resolver.service.js';
import { LimitesPlanService } from './limites-plan.service.js';
import { TenantContext } from './tenant-context.service.js';
import { TenantGuard } from './tenant.guard.js';
import { TenantSubscriber } from './tenant.subscriber.js';
import { RelojSubscriber } from './reloj.subscriber.js';

/**
 * Multiempresa (SaaS): contexto CLS por request y resolucion de la empresa.
 * Global para que cualquier service o repositorio inyecte TenantContext. El
 * guard se registra como APP_GUARD en CommonModule, despues de JwtAuthGuard.
 * LimitesPlanService hace cumplir los limites del plan de la empresa.
 */
@Global()
@Module({
  imports: [ClsModule.forRoot({ global: true, middleware: { mount: true } }), TypeOrmModule.forFeature([Empresa, Plan])],
  providers: [TenantContext, EmpresaResolver, TenantGuard, TenantSubscriber, RelojSubscriber, LimitesPlanService],
  exports: [TenantContext, EmpresaResolver, TenantGuard, LimitesPlanService],
})
export class TenantModule {}

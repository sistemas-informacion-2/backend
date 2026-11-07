import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClsModule } from 'nestjs-cls';
import { Empresa } from '../../modules/plataforma/entities/empresa.entity.js';
import { EmpresaResolver } from './empresa-resolver.service.js';
import { TenantContext } from './tenant-context.service.js';
import { TenantGuard } from './tenant.guard.js';
import { TenantSubscriber } from './tenant.subscriber.js';
import { RelojSubscriber } from './reloj.subscriber.js';

/**
 * Multiempresa (SaaS): contexto CLS por request y resolucion de la empresa.
 * Global para que cualquier service o repositorio inyecte TenantContext. El
 * guard se registra como APP_GUARD en CommonModule, despues de JwtAuthGuard.
 */
@Global()
@Module({
  imports: [ClsModule.forRoot({ global: true, middleware: { mount: true } }), TypeOrmModule.forFeature([Empresa])],
  providers: [TenantContext, EmpresaResolver, TenantGuard, TenantSubscriber, RelojSubscriber],
  exports: [TenantContext, EmpresaResolver, TenantGuard],
})
export class TenantModule {}

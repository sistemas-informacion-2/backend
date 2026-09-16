import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bitacora } from '../modules/acceso/entities/bitacora.entity.js';
import { BitacoraRepository } from '../modules/acceso/repositories/bitacora.repository.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';
import { TransformInterceptor } from './interceptors/transform.interceptor.js';
import { AuditInterceptor } from './interceptors/audit.interceptor.js';

@Module({
  imports: [TypeOrmModule.forFeature([Bitacora])],
  providers: [
    BitacoraRepository,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class CommonModule {}

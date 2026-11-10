import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource, type EntitySubscriberInterface, type InsertEvent } from 'typeorm';
import { TenantContext } from './tenant-context.service.js';

/**
 * Red de seguridad al escribir: toda entidad con la propiedad `idEmpresa` que
 * se inserte sin empresa recibe la del contexto, y una que traiga otra empresa
 * distinta a la del contexto se rechaza. Asi un service que olvide asignar la
 * empresa no deja filas huerfanas ni escribe en otra tienda.
 *
 * Fuera de un contexto con empresa (seeders, tareas de plataforma) no hace
 * nada: ahi la empresa se asigna explicitamente.
 */
@Injectable()
export class TenantSubscriber implements EntitySubscriberInterface {
  constructor(
    dataSource: DataSource,
    private readonly tenant: TenantContext,
  ) {
    dataSource.subscribers.push(this);
  }

  beforeInsert(event: InsertEvent<{ idEmpresa?: number | null }>): void {
    if (!event.entity || !event.metadata.findColumnWithPropertyName('idEmpresa')) return;

    const empresaActual = this.tenant.empresa()?.id;
    if (empresaActual === undefined) return;

    if (event.entity.idEmpresa == null) {
      event.entity.idEmpresa = empresaActual;
    } else if (event.entity.idEmpresa !== empresaActual) {
      throw new ForbiddenException(`No se puede crear ${event.metadata.tableName} para otra empresa`);
    }
  }
}

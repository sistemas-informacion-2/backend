import { Injectable } from '@nestjs/common';
import { DataSource, type EntitySubscriberInterface, type InsertEvent } from 'typeorm';
import type { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata.js';
import { ahora, relojSimulado } from '../utils/reloj.js';

const DEFAULTS_DE_FECHA = new Set(['CURRENT_TIMESTAMP', 'CURRENT_DATE', 'now()']);

function tomaLaFechaDeLaBase(columna: ColumnMetadata): boolean {
  if (columna.isCreateDate || columna.isUpdateDate) return true;
  const porDefecto = typeof columna.default === 'function' ? (columna.default as () => string)() : null;
  return porDefecto !== null && DEFAULTS_DE_FECHA.has(porDefecto);
}

/**
 * Con el reloj simulado (solo el generador de historia), las columnas cuya fecha la pone la base (kardex, reservas,
 * notas de compra y devolucion, notificaciones, altas...) reciben la hora simulada en lugar de la del servidor de
 * base de datos. Con el reloj real no hace nada.
 */
@Injectable()
export class RelojSubscriber implements EntitySubscriberInterface {
  constructor(dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  beforeInsert(event: InsertEvent<Record<string, unknown>>): void {
    if (!relojSimulado() || !event.entity) return;
    const momento = ahora();
    for (const columna of event.metadata.columns) {
      if (!tomaLaFechaDeLaBase(columna)) continue;
      if (event.entity[columna.propertyName] == null) event.entity[columna.propertyName] = momento;
    }
  }
}

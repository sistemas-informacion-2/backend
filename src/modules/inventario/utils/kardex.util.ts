import type { EntityManager } from 'typeorm';
import type { Inventario } from '../entities/inventario.entity.js';
import {
  MovimientoInventario,
  type ReferenciaMovimiento,
  type TipoMovimientoInventario,
} from '../entities/movimiento-inventario.entity.js';

export interface DatosMovimiento {
  tipo: TipoMovimientoInventario;
  /** Cambio del stock disponible (+ entra, - sale). */
  cantidad: number;
  /** Cambio del stock reservado; 0 si no es una reserva. */
  deltaReservado?: number;
  costoUnitario?: number | null;
  referenciaTipo?: ReferenciaMovimiento | null;
  referenciaId?: number | null;
  idUsuario?: number | null;
  motivo?: string | null;
}

/** La fila de inventario despues del cambio: de ahi salen el almacen, la variante y el stock resultante. */
type FilaInventario = Pick<Inventario, 'idAlmacen' | 'idVarianteProducto' | 'stockDisponible' | 'stockReservado'>;

/**
 * Escribe en el kardex el cambio que se acaba de aplicar a `inventario` (ya con su stock nuevo). Debe ir en la
 * misma transaccion (`manager`) que guardo ese stock: o quedan los dos, o ninguno. La empresa la asigna el
 * TenantSubscriber, que corre tambien en el vencimiento automatico de reservas (TenantContext.ejecutarParaEmpresa).
 */
export async function registrarMovimiento(manager: EntityManager, inventario: FilaInventario, datos: DatosMovimiento): Promise<void> {
  const repo = manager.getRepository(MovimientoInventario);
  await repo.save(
    repo.create({
      idAlmacen: inventario.idAlmacen,
      idVarianteProducto: inventario.idVarianteProducto,
      tipo: datos.tipo,
      cantidad: datos.cantidad,
      deltaReservado: datos.deltaReservado ?? 0,
      stockResultante: inventario.stockDisponible,
      reservadoResultante: inventario.stockReservado,
      costoUnitario: datos.costoUnitario ?? null,
      referenciaTipo: datos.referenciaTipo ?? null,
      referenciaId: datos.referenciaId ?? null,
      idUsuario: datos.idUsuario ?? null,
      motivo: datos.motivo?.trim().slice(0, 255) || null,
    }),
  );
}

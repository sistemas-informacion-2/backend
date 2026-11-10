import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Empresa } from '../../plataforma/entities/empresa.entity.js';
import { Almacen } from './almacen.entity.js';
import { VarianteProducto } from './variante-producto.entity.js';

export type TipoMovimientoInventario =
  | 'SALDO_INICIAL'
  | 'ENTRADA_COMPRA'
  | 'SALIDA_VENTA'
  | 'RESERVA'
  | 'LIBERACION_RESERVA'
  | 'SALIDA_RESERVA'
  | 'DEVOLUCION_REINGRESO'
  | 'MERMA'
  | 'AJUSTE_ENTRADA'
  | 'AJUSTE_SALIDA'
  | 'TRANSFERENCIA_SALIDA'
  | 'TRANSFERENCIA_ENTRADA';

export type ReferenciaMovimiento = 'NOTA_VENTA' | 'NOTA_COMPRA' | 'RESERVA' | 'NOTA_DEVOLUCION' | 'AJUSTE' | 'TRANSFERENCIA';

/** Postgres devuelve NUMERIC como string; lo convertimos a number en ambos sentidos. */
const TRANSFORMER_DECIMAL = {
  to: (valor: number | null) => valor,
  from: (valor: string | null) => (valor === null ? null : Number(valor)),
};

/**
 * Kardex: cada cambio del stock de una variante en un almacen, en la misma transaccion que lo produce. La suma de
 * `cantidad` de una fila de inventario es su stock_disponible y la de `deltaReservado` su stock_reservado, asi que
 * el historial siempre explica el stock actual. Lo escribe kardex.util (registrarMovimiento).
 */
@Index('idx_movimiento_inventario_empresa_fecha', ['idEmpresa', 'fechaHora'])
@Index('idx_movimiento_inventario_stock', ['idAlmacen', 'idVarianteProducto', 'fechaHora'])
@Index('idx_movimiento_inventario_referencia', ['referenciaTipo', 'referenciaId'])
@Entity('movimiento_inventario')
export class MovimientoInventario {
  @PrimaryGeneratedColumn()
  id: number;

  /** Empresa duena del movimiento (la del almacen). */
  @Column({ name: 'id_empresa', type: 'int' })
  idEmpresa: number;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Relation<Empresa>;

  @Column({ name: 'id_almacen', type: 'int' })
  idAlmacen: number;

  @ManyToOne(() => Almacen)
  @JoinColumn({ name: 'id_almacen' })
  almacen: Relation<Almacen>;

  @Column({ name: 'id_variante_producto', type: 'int' })
  idVarianteProducto: number;

  @ManyToOne(() => VarianteProducto)
  @JoinColumn({ name: 'id_variante_producto' })
  variante: Relation<VarianteProducto>;

  @Column({ type: 'varchar', length: 30 })
  tipo: TipoMovimientoInventario;

  /** Cambio del stock disponible: positivo entra, negativo sale. */
  @Column({ type: 'int' })
  cantidad: number;

  /** Cambio del stock reservado (reservas): +apartado, -liberado o entregado. */
  @Column({ name: 'delta_reservado', type: 'int', default: 0 })
  deltaReservado: number;

  @Column({ name: 'stock_resultante', type: 'int' })
  stockResultante: number;

  @Column({ name: 'reservado_resultante', type: 'int', default: 0 })
  reservadoResultante: number;

  /** Costo por unidad del movimiento: precio de compra en entradas, costo promedio en salidas. */
  @Column({ name: 'costo_unitario', type: 'decimal', precision: 12, scale: 4, nullable: true, transformer: TRANSFORMER_DECIMAL })
  costoUnitario: number | null;

  @Column({ name: 'referencia_tipo', type: 'varchar', length: 20, nullable: true })
  referenciaTipo: ReferenciaMovimiento | null;

  @Column({ name: 'referencia_id', type: 'int', nullable: true })
  referenciaId: number | null;

  /** Quien lo hizo; null si fue el sistema (p. ej. el vencimiento automatico de reservas). */
  @Column({ name: 'id_usuario', type: 'int', nullable: true })
  idUsuario: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  motivo: string | null;

  @Column({ name: 'fecha_hora', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaHora: Date;
}

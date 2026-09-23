import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Proveedor } from '../../inventario/entities/proveedor.entity.js';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';
import { MovimientoCaja } from './movimiento-caja.entity.js';
import { DetalleNotaCompra } from './detalle-nota-compra.entity.js';

export type EstadoCompra = 'Recibido';

/**
 * Compra de mercaderia a un proveedor (CU15). Pertenece a una sucursal: los
 * almacenes de destino de sus lineas y la caja del egreso deben ser de esa sucursal.
 */
@Entity('nota_compra')
export class NotaCompra {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_proveedor', type: 'int' })
  idProveedor: number;

  @ManyToOne(() => Proveedor)
  @JoinColumn({ name: 'id_proveedor' })
  proveedor: Relation<Proveedor>;

  @Column({ name: 'id_sucursal', type: 'int' })
  idSucursal: number;

  @ManyToOne(() => Sucursal)
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Relation<Sucursal>;

  /** Egreso de caja cuando la compra se pago en efectivo desde la caja de la sucursal. */
  @Column({ name: 'id_movimiento_caja', type: 'int', nullable: true })
  idMovimientoCaja: number | null;

  @ManyToOne(() => MovimientoCaja)
  @JoinColumn({ name: 'id_movimiento_caja' })
  movimientoCaja: Relation<MovimientoCaja> | null;

  @Column({ name: 'nro_factura', type: 'varchar', length: 50, nullable: true })
  nroFactura: string | null;

  @Column({ name: 'fecha_emision', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaEmision: Date;

  @Column({ name: 'fecha_entrega_programada', type: 'date', nullable: true })
  fechaEntregaProgramada: string | null;

  @Column({ name: 'fecha_pago', type: 'date', nullable: true })
  fechaPago: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total: string;

  @Column({ type: 'varchar', length: 30, default: 'Recibido' })
  estado: EstadoCompra;

  @OneToMany(() => DetalleNotaCompra, (detalle) => detalle.notaCompra)
  detalles: Relation<DetalleNotaCompra>[];
}

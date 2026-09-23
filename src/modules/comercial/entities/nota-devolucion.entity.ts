import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Cliente } from '../../operaciones/entities/cliente.entity.js';
import { Empleado } from '../../operaciones/entities/empleado.entity.js';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';
import { DetalleNotaDevolucion } from './detalle-nota-devolucion.entity.js';
import { MovimientoCaja } from './movimiento-caja.entity.js';
import { NotaVenta } from './nota-venta.entity.js';
import { Reserva } from '../../electronico/entities/reserva.entity.js';

export type TipoDevolucion = 'PRODUCTO_ENTREGADO' | 'CANCELACION_RESERVA';
export type MotivoDevolucion = 'FALLA_FABRICA' | 'TALLA_INCORRECTA' | 'ARREPENTIMIENTO' | 'CANCELACION';

/** Postgres devuelve NUMERIC como string; lo convertimos a number en ambos sentidos. */
const TRANSFORMER_DECIMAL = {
  to: (valor: number) => valor,
  from: (valor: string | null) => (valor === null ? null : Number(valor)),
};

/**
 * Devolución (CU24) de una nota de venta o de una reserva cancelada con anticipo.
 * El reembolso sale como EGRESO de la caja del cajero (`id_movimiento_caja`).
 */
@Entity('nota_devolucion')
export class NotaDevolucion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'codigo_devolucion', type: 'varchar', length: 20, unique: true })
  codigoDevolucion: string;

  @Column({ name: 'id_cliente', type: 'int' })
  idCliente: number;

  @ManyToOne(() => Cliente)
  @JoinColumn({ name: 'id_cliente' })
  cliente: Relation<Cliente>;

  @Column({ name: 'id_sucursal', type: 'int' })
  idSucursal: number;

  @ManyToOne(() => Sucursal)
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Relation<Sucursal>;

  @Column({ name: 'id_cajero', type: 'int' })
  idCajero: number;

  @ManyToOne(() => Empleado)
  @JoinColumn({ name: 'id_cajero' })
  cajero: Relation<Empleado>;

  @Column({ name: 'id_nota_venta', type: 'int', nullable: true })
  idNotaVenta: number | null;

  @ManyToOne(() => NotaVenta, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_nota_venta' })
  notaVenta: Relation<NotaVenta> | null;

  @Column({ name: 'id_reserva', type: 'int', nullable: true })
  idReserva: number | null;

  @ManyToOne(() => Reserva, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_reserva' })
  reserva: Relation<Reserva> | null;

  @Column({ name: 'id_movimiento_caja', type: 'int', nullable: true })
  idMovimientoCaja: number | null;

  @ManyToOne(() => MovimientoCaja, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_movimiento_caja' })
  movimientoCaja: Relation<MovimientoCaja> | null;

  @Column({
    name: 'tipo_devolucion',
    type: 'enum',
    enum: ['PRODUCTO_ENTREGADO', 'CANCELACION_RESERVA'],
    enumName: 'tipo_devolucion_enum',
  })
  tipoDevolucion: TipoDevolucion;

  @Column({
    name: 'motivo_devolucion',
    type: 'enum',
    enum: ['FALLA_FABRICA', 'TALLA_INCORRECTA', 'ARREPENTIMIENTO', 'CANCELACION'],
    enumName: 'motivo_devolucion_enum',
  })
  motivoDevolucion: MotivoDevolucion;

  @Column({ name: 'monto_total_reembolsado', type: 'decimal', precision: 12, scale: 2, transformer: TRANSFORMER_DECIMAL })
  montoTotalReembolsado: number;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @Column({ name: 'fecha_emision', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaEmision: Date;

  @OneToMany(() => DetalleNotaDevolucion, (detalle) => detalle.notaDevolucion)
  detalles: Relation<DetalleNotaDevolucion>[];
}

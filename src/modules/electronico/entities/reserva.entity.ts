import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Cliente } from '../../operaciones/entities/cliente.entity.js';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';
import { DetalleReserva } from './detalle-reserva.entity.js';
import { Pago } from '../../comercial/entities/pago.entity.js';

export type EstadoReserva = 'PENDIENTE' | 'PAGADA' | 'CANCELADA' | 'COMPLETADA';

/** Postgres devuelve NUMERIC como string; lo convertimos a number en ambos sentidos. */
const TRANSFORMER_DECIMAL = {
  to: (valor: number) => valor,
  from: (valor: string | null) => (valor === null ? null : Number(valor)),
};

/**
 * Reserva de prendas (CU23): aparta stock de una sucursal contra un anticipo hasta
 * `fechaLimite`. Al liquidarse se convierte en una nota de venta; al vencer o
 * cancelarse libera el stock reservado.
 */
@Entity('reserva')
export class Reserva {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'codigo_reserva', type: 'varchar', length: 20, unique: true })
  codigoReserva: string;

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

  @Column({ name: 'fecha_reserva', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaReserva: Date;

  @Column({ name: 'fecha_limite', type: 'timestamp' })
  fechaLimite: Date;

  @Column({
    type: 'enum',
    enum: ['PENDIENTE', 'PAGADA', 'CANCELADA', 'COMPLETADA'],
    enumName: 'estado_reserva_enum',
    default: 'PENDIENTE',
  })
  estado: EstadoReserva;

  @Column({ name: 'monto_anticipo', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: TRANSFORMER_DECIMAL })
  montoAnticipo: number;

  @Column({ name: 'monto_total', type: 'decimal', precision: 12, scale: 2, transformer: TRANSFORMER_DECIMAL })
  montoTotal: number;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @OneToMany(() => DetalleReserva, (detalle) => detalle.reserva)
  detalles: Relation<DetalleReserva>[];

  @OneToMany(() => Pago, (pago) => pago.reserva)
  pagos: Relation<Pago>[];
}

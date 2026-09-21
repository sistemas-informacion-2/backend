import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { PasarelaPago } from './pasarela-pago.entity.js';
import { MovimientoCaja } from './movimiento-caja.entity.js';
import { NotaVenta } from './nota-venta.entity.js';
import { Reserva } from '../../electronico/entities/reserva.entity.js';

export type ConceptoPago = 'PAGO_TOTAL' | 'ANTICIPO_RESERVA' | 'SALDO_LIQUIDACION' | 'REEMBOLSO';

/** Postgres devuelve NUMERIC como string; lo convertimos a number en ambos sentidos. */
const TRANSFORMER_DECIMAL = {
  to: (valor: number) => valor,
  from: (valor: string | null) => (valor === null ? null : Number(valor)),
};

/**
 * Registro de un pago (CU12). Todo pago pasa por un `movimiento_caja` de la caja
 * abierta y puede referenciar una nota de venta y/o una reserva.
 */
@Entity('pago')
export class Pago {
  @PrimaryGeneratedColumn()
  id: number;

  /** Nulo en pagos en linea, que no pasan por una caja fisica. */
  @Column({ name: 'id_movimiento_caja', type: 'int', nullable: true })
  idMovimientoCaja: number | null;

  @ManyToOne(() => MovimientoCaja, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_movimiento_caja' })
  movimientoCaja: Relation<MovimientoCaja> | null;

  @Column({ name: 'id_pasarela', type: 'int', nullable: true })
  idPasarela: number | null;

  @ManyToOne(() => PasarelaPago)
  @JoinColumn({ name: 'id_pasarela' })
  pasarela: Relation<PasarelaPago> | null;

  @Column({ name: 'id_nota_venta', type: 'int', nullable: true })
  idNotaVenta: number | null;

  @ManyToOne(() => NotaVenta, (nota) => nota.pagos, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_nota_venta' })
  notaVenta: Relation<NotaVenta> | null;

  @Column({ name: 'id_reserva', type: 'int', nullable: true })
  idReserva: number | null;

  @ManyToOne(() => Reserva, (reserva) => reserva.pagos, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_reserva' })
  reserva: Relation<Reserva> | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: TRANSFORMER_DECIMAL })
  monto: number;

  @Column({ type: 'enum', enum: ['PAGO_TOTAL', 'ANTICIPO_RESERVA', 'SALDO_LIQUIDACION', 'REEMBOLSO'], enumName: 'concepto_pago_enum' })
  concepto: ConceptoPago;

  /** Id de la transaccion en la pasarela (orden de PayPal, etc.); unico para que un cobro no se registre dos veces. */
  @Column({ name: 'referencia_externa', type: 'varchar', length: 100, nullable: true, unique: true })
  referenciaExterna: string | null;

  @Column({ name: 'fecha_pago', type: 'date' })
  fechaPago: string;

  @Column({ name: 'hora_pago', type: 'time' })
  horaPago: string;
}

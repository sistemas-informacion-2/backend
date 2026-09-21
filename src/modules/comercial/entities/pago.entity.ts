import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { PasarelaPago } from './pasarela-pago.entity.js';
import { MovimientoCaja } from './movimiento-caja.entity.js';
import { NotaVenta } from './nota-venta.entity.js';

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

  @Column({ name: 'id_movimiento_caja', type: 'int' })
  idMovimientoCaja: number;

  @ManyToOne(() => MovimientoCaja, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_movimiento_caja' })
  movimientoCaja: Relation<MovimientoCaja>;

  @Column({ name: 'id_pasarela', type: 'int', nullable: true })
  idPasarela: number | null;

  @ManyToOne(() => PasarelaPago)
  @JoinColumn({ name: 'id_pasarela' })
  pasarela: Relation<PasarelaPago> | null;

  @Column({ name: 'id_nota_venta', type: 'int', nullable: true })
  idNotaVenta: number | null;

  @ManyToOne(() => NotaVenta, (nota) => nota.pagos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_nota_venta' })
  notaVenta: Relation<NotaVenta> | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: TRANSFORMER_DECIMAL })
  monto: number;

  @Column({ type: 'enum', enum: ['PAGO_TOTAL', 'ANTICIPO_RESERVA', 'SALDO_LIQUIDACION', 'REEMBOLSO'] })
  concepto: ConceptoPago;

  @Column({ name: 'fecha_pago', type: 'date' })
  fechaPago: string;

  @Column({ name: 'hora_pago', type: 'time' })
  horaPago: string;
}

import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Caja } from './caja.entity.js';

export type TipoMovimientoCaja = 'INGRESO' | 'EGRESO';

/**
 * Movimiento de efectivo de una caja (CU15). `INGRESO` suma y `EGRESO` resta al
 * monto esperado del turno. Su `id` es el que referenciarán los pagos de ventas
 * presenciales (CU12) y las compras (CU14) mediante `movimiento_caja`.
 */
@Entity('movimiento_caja')
export class MovimientoCaja {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_caja', type: 'int' })
  idCaja: number;

  @ManyToOne(() => Caja, (caja) => caja.movimientos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_caja' })
  caja: Relation<Caja>;

  @Column({ type: 'varchar', length: 20 })
  tipo: TipoMovimientoCaja;

  @Column({ type: 'varchar', length: 150 })
  concepto: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monto: string;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @Column({ name: 'fecha_hora', type: 'timestamp' })
  fechaHora: Date;
}

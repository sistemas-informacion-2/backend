import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Caja } from './caja.entity.js';

export type TipoMovimientoCaja = 'INGRESO' | 'EGRESO';

/**
 * Para que se usa la plata del movimiento (base de las finanzas del BI). Las cinco primeras las asigna solo el
 * sistema al registrar ventas, reservas, compras y devoluciones; las demas son las que elige el cajero a mano.
 */
export type CategoriaMovimientoCaja =
  | 'VENTA'
  | 'ANTICIPO_RESERVA'
  | 'SALDO_RESERVA'
  | 'COMPRA'
  | 'REEMBOLSO'
  | 'GASTO_OPERATIVO'
  | 'RETIRO'
  | 'APORTE'
  | 'OTRO_INGRESO'
  | 'OTRO_EGRESO';

/** Categorias que se pueden elegir al registrar un movimiento manual, segun su tipo. */
export const CATEGORIAS_MANUALES: Record<TipoMovimientoCaja, readonly CategoriaMovimientoCaja[]> = {
  INGRESO: ['APORTE', 'OTRO_INGRESO'],
  EGRESO: ['GASTO_OPERATIVO', 'RETIRO', 'OTRO_EGRESO'],
};

/** Detalle de un gasto operativo; obligatorio solo en esa categoria. */
export type SubcategoriaGasto = 'ALQUILER' | 'SUELDOS' | 'SERVICIOS' | 'MARKETING' | 'TRANSPORTE' | 'MANTENIMIENTO' | 'OTROS';

export const SUBCATEGORIAS_GASTO: readonly SubcategoriaGasto[] = ['ALQUILER', 'SUELDOS', 'SERVICIOS', 'MARKETING', 'TRANSPORTE', 'MANTENIMIENTO', 'OTROS'];

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

  @Column({ type: 'varchar', length: 30 })
  categoria: CategoriaMovimientoCaja;

  @Column({ name: 'subcategoria_gasto', type: 'varchar', length: 30, nullable: true })
  subcategoriaGasto: SubcategoriaGasto | null;

  @Column({ type: 'varchar', length: 150 })
  concepto: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monto: string;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @Column({ name: 'fecha_hora', type: 'timestamp' })
  fechaHora: Date;
}

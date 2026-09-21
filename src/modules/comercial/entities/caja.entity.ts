import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';
import { Empleado } from '../../operaciones/entities/empleado.entity.js';
import { MovimientoCaja } from './movimiento-caja.entity.js';

export type EstadoCaja = 'Abierta' | 'Cerrada';

/**
 * Turno de caja de una sucursal (CU15). Una sucursal solo puede tener una caja
 * `Abierta` a la vez. La caja queda atada al cajero que la abre mediante
 * `idCajero` (empleado.id_usuario); es nulo cuando la abre un usuario sin legajo
 * de empleado, como el administrador.
 */
@Entity('caja')
export class Caja {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_sucursal', type: 'int' })
  idSucursal: number;

  @ManyToOne(() => Sucursal)
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Relation<Sucursal>;

  @Column({ name: 'id_cajero', type: 'int', nullable: true })
  idCajero: number | null;

  @ManyToOne(() => Empleado)
  @JoinColumn({ name: 'id_cajero' })
  cajero: Relation<Empleado> | null;

  @Column({ name: 'fecha_apertura', type: 'timestamp' })
  fechaApertura: Date;

  @Column({ name: 'fecha_cierre', type: 'timestamp', nullable: true })
  fechaCierre: Date | null;

  @Column({ name: 'hora_apertura', type: 'time' })
  horaApertura: string;

  @Column({ name: 'hora_cierre', type: 'time', nullable: true })
  horaCierre: string | null;

  @Column({ name: 'monto_inicial', type: 'decimal', precision: 12, scale: 2, default: 0 })
  montoInicial: string;

  @Column({ name: 'monto_final', type: 'decimal', precision: 12, scale: 2, nullable: true })
  montoFinal: string | null;

  @Column({ type: 'varchar', length: 20, default: 'Abierta' })
  estado: EstadoCaja;

  @OneToMany(() => MovimientoCaja, (movimiento) => movimiento.caja)
  movimientos: Relation<MovimientoCaja>[];
}

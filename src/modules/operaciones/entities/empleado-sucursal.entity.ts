import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { Sucursal } from './sucursal.entity.js';
import { Empleado } from './empleado.entity.js';

@Entity('empleado_sucursal')
export class EmpleadoSucursal {
  @PrimaryColumn({ name: 'id_empleado' })
  idEmpleado: number;

  @PrimaryColumn({ name: 'id_sucursal' })
  idSucursal: number;

  @ManyToOne(() => Empleado, (empleado) => empleado.asignacionesSucursal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_empleado' })
  empleado: Relation<Empleado>;

  @ManyToOne(() => Sucursal, (sucursal) => sucursal.empleadosSucursal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Relation<Sucursal>;

  @Column({ name: 'fecha_asignacion', type: 'date', default: () => 'CURRENT_DATE' })
  fechaAsignacion: string;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}

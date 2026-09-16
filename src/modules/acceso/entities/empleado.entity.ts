import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryColumn, type Relation } from 'typeorm';
import { Usuario } from './usuario.entity.js';
import { EmpleadoSucursal } from '../../operaciones/entities/empleado-sucursal.entity.js';

@Entity('empleado')
export class Empleado {
  @PrimaryColumn({ name: 'id_usuario' })
  idUsuario: number;

  @OneToOne(() => Usuario)
  @JoinColumn({ name: 'id_usuario' })
  usuario: Relation<Usuario>;

  @Column({ name: 'codigo_empleado', length: 50, unique: true })
  codigoEmpleado: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  salario: string;

  @Column({ name: 'fecha_contratacion', type: 'date' })
  fechaContratacion: string;

  @Column({ name: 'fecha_finalizacion', type: 'date', nullable: true })
  fechaFinalizacion: string | null;

  @OneToMany(() => EmpleadoSucursal, (es) => es.empleado)
  asignacionesSucursal: Relation<EmpleadoSucursal>[];
}

import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Ciudad } from './ciudad.entity.js';
import { EmpleadoSucursal } from './empleado-sucursal.entity.js';

@Entity('sucursal')
export class Sucursal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_ciudad', type: 'int' })
  idCiudad: number;

  @ManyToOne(() => Ciudad, (ciudad) => ciudad.sucursales)
  @JoinColumn({ name: 'id_ciudad' })
  ciudad: Relation<Ciudad>;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  telefono: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  correo: string | null;

  @Column({ name: 'horario_apertura', type: 'time', nullable: true })
  horarioApertura: string | null;

  @Column({ name: 'horario_cierre', type: 'time', nullable: true })
  horarioCierre: string | null;

  @Column({ type: 'varchar', length: 100 })
  ubicacion: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @OneToMany(() => EmpleadoSucursal, (es) => es.sucursal)
  empleadosSucursal: Relation<EmpleadoSucursal>[];
}

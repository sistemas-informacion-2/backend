import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { Rol } from './rol.entity.js';
import { Permiso } from './permiso.entity.js';

@Entity('rol_permiso')
export class RolPermiso {
  @PrimaryColumn({ name: 'id_rol' })
  idRol: number;

  @PrimaryColumn({ name: 'id_permiso' })
  idPermiso: number;

  @ManyToOne(() => Rol, (rol) => rol.rolesPermiso, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_rol' })
  rol: Relation<Rol>;

  @ManyToOne(() => Permiso, (permiso) => permiso.rolesPermiso, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_permiso' })
  permiso: Relation<Permiso>;

  @Column({ name: 'fecha_asignacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaAsignacion: Date;

  @Column({ default: true })
  activo: boolean;
}

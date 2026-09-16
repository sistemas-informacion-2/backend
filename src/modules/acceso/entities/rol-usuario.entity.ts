import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { Rol } from './rol.entity.js';
import { Usuario } from './usuario.entity.js';

@Entity('rol_usuario')
export class RolUsuario {
  @PrimaryColumn({ name: 'id_rol' })
  idRol: number;

  @PrimaryColumn({ name: 'id_usuario' })
  idUsuario: number;

  @ManyToOne(() => Rol, (rol) => rol.rolesUsuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_rol' })
  rol: Relation<Rol>;

  @ManyToOne(() => Usuario, (usuario) => usuario.rolesUsuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Relation<Usuario>;

  @Column({ name: 'fecha_asignacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaAsignacion: Date;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}

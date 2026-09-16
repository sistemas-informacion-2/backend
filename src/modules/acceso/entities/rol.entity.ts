import { Column, Entity, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { RolPermiso } from './rol-permiso.entity.js';
import { RolUsuario } from './rol-usuario.entity.js';

@Entity('rol')
export class Rol {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ name: 'fecha_creacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaCreacion: Date;

  @Column({ default: true })
  activo: boolean;

  @OneToMany(() => RolPermiso, (rp) => rp.rol)
  rolesPermiso: Relation<RolPermiso>[];

  @OneToMany(() => RolUsuario, (ru) => ru.rol)
  rolesUsuario: Relation<RolUsuario>[];
}

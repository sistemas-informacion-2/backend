import { Column, Entity, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { RolPermiso } from './rol-permiso.entity.js';

@Entity('permiso')
export class Permiso {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  accion: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ name: 'fecha_creacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaCreacion: Date;

  @Column({ default: true })
  activo: boolean;

  @OneToMany(() => RolPermiso, (rp) => rp.permiso)
  rolesPermiso: Relation<RolPermiso>[];
}

import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Empresa } from '../../plataforma/entities/empresa.entity.js';
import { RolPermiso } from './rol-permiso.entity.js';
import { RolUsuario } from './rol-usuario.entity.js';

@Index('uq_rol_empresa_nombre', ['idEmpresa', 'nombre'], { unique: true })
@Entity('rol')
export class Rol {
  @PrimaryGeneratedColumn()
  id: number;

  /** Cada empresa tiene sus propios roles. */
  @Column({ name: 'id_empresa', type: 'int' })
  idEmpresa: number;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Relation<Empresa>;

  @Column({ length: 50 })
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

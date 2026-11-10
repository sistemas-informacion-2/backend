import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Empresa } from '../../plataforma/entities/empresa.entity.js';
import { RolUsuario } from './rol-usuario.entity.js';
import { Sesion } from './sesion.entity.js';

/** A = administrador de empresa, E = empleado, C = cliente, S = superadmin de la plataforma (sin empresa). */
export type TipoUsuario = 'A' | 'E' | 'C' | 'S';
export type EstadoAcceso = 'HABILITADO' | 'BLOQUEADO' | 'SUSPENDIDO';

// El email es unico dentro de cada empresa (una persona puede tener cuenta en
// varias tiendas) y, aparte, entre los superadmin de la plataforma.
@Index('uq_usuario_empresa_email', ['idEmpresa', 'email'], { unique: true })
@Index('uq_usuario_plataforma_email', ['email'], { unique: true, where: '"id_empresa" IS NULL' })
@Entity('usuario')
export class Usuario {
  @PrimaryGeneratedColumn()
  id: number;

  /** Empresa del usuario; null solo para el superadmin de la plataforma. */
  @Column({ name: 'id_empresa', type: 'int', nullable: true })
  idEmpresa: number | null;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Relation<Empresa> | null;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 100 })
  apellido: string;

  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  telefono: string | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'char', length: 1, nullable: true })
  sexo: string | null;

  @Column({ name: 'tipo_usuario', type: 'char', length: 1 })
  tipoUsuario: TipoUsuario;

  @Column({
    name: 'estado_acceso',
    type: 'varchar',
    length: 20,
    default: 'HABILITADO',
  })
  estadoAcceso: EstadoAcceso;

  @Column({ name: 'intentos_fallidos', type: 'int', default: 0 })
  intentosFallidos: number;

  @Column({ name: 'fecha_creacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaCreacion: Date;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @OneToMany(() => RolUsuario, (rolUsuario) => rolUsuario.usuario)
  rolesUsuario: Relation<RolUsuario>[];

  @OneToMany(() => Sesion, (sesion) => sesion.usuario)
  sesiones: Relation<Sesion>[];
}

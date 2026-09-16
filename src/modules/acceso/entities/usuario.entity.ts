import { Column, Entity, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { RolUsuario } from './rol-usuario.entity.js';
import { Sesion } from './sesion.entity.js';

export type TipoUsuario = 'A' | 'E' | 'C';
export type EstadoAcceso = 'HABILITADO' | 'BLOQUEADO' | 'SUSPENDIDO';

@Entity('usuario')
export class Usuario {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 100 })
  apellido: string;

  @Column({ type: 'varchar', length: 150, unique: true })
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

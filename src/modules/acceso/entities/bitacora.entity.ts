import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Empresa } from '../../plataforma/entities/empresa.entity.js';
import { Usuario } from './usuario.entity.js';

@Index('idx_bitacora_empresa_fecha', ['idEmpresa', 'fechaHora'])
@Entity('bitacora')
export class Bitacora {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  /** Empresa en la que ocurrio la accion; null para acciones de la plataforma. */
  @Column({ name: 'id_empresa', type: 'int', nullable: true })
  idEmpresa: number | null;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Relation<Empresa> | null;

  @Column({ name: 'id_usuario', type: 'int', nullable: true })
  idUsuario: number | null;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Relation<Usuario> | null;

  @Column({ type: 'varchar', length: 100 })
  accion: string;

  @Column({ name: 'tabla_afectada', type: 'varchar', length: 100 })
  tablaAfectada: string;

  @Column({ name: 'ip_origen', type: 'varchar', length: 45, nullable: true })
  ipOrigen: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ name: 'datos_anteriores', type: 'jsonb', nullable: true })
  datosAnteriores: Record<string, unknown> | null;

  @Column({ name: 'datos_nuevos', type: 'jsonb', nullable: true })
  datosNuevos: Record<string, unknown> | null;

  @Column({ name: 'fecha_hora', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaHora: Date;
}

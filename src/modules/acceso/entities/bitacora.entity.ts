import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Usuario } from './usuario.entity.js';

@Entity('bitacora')
export class Bitacora {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

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

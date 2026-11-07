import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Empresa } from '../../plataforma/entities/empresa.entity.js';
import { Usuario } from '../../acceso/entities/usuario.entity.js';

/**
 * Notificacion persistida para un usuario (CU19). La difusion a todos los
 * clientes se materializa como fan-out: una fila por destinatario, ya que
 * `id_usuario` es obligatorio.
 */
@Index('idx_notificacion_push_empresa', ['idEmpresa'])
@Entity('notificacion_push')
export class NotificacionPush {
  @PrimaryGeneratedColumn()
  id: number;

  /** Empresa (tienda) duena del registro. */
  @Column({ name: 'id_empresa', type: 'int' })
  idEmpresa: number;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Relation<Empresa>;

  @Column({ name: 'id_usuario', type: 'int' })
  idUsuario: number;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Relation<Usuario>;

  @Column({ type: 'varchar', length: 150 })
  titulo: string;

  @Column({ type: 'text' })
  mensaje: string;

  @Column({ type: 'boolean', default: false })
  leido: boolean;

  @Column({ name: 'fecha_envio', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaEnvio: Date;
}

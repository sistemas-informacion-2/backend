import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Usuario } from '../../acceso/entities/usuario.entity.js';

/**
 * Navegador donde un usuario recibe notificaciones push (Web Push). Un usuario puede tener varios. El endpoint es
 * unico: si otra persona inicia sesion en el mismo navegador, la fila se reasigna.
 */
@Entity('suscripcion_web_push')
export class SuscripcionWebPush {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_usuario', type: 'int' })
  idUsuario: number;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Relation<Usuario>;

  /** Direccion del servicio push del navegador (Google, Mozilla, Microsoft o Apple). */
  @Column({ type: 'text', unique: true })
  endpoint: string;

  @Column({ type: 'varchar', length: 255 })
  p256dh: string;

  @Column({ type: 'varchar', length: 100 })
  auth: string;

  @Column({ name: 'fecha_actualizacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaActualizacion: Date;
}

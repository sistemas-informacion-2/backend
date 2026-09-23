import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Usuario } from '../../acceso/entities/usuario.entity.js';

export type PlataformaPush = 'android' | 'ios';

/**
 * Celular donde un usuario recibe notificaciones push (Expo Push Service). Un usuario puede tener
 * varios. El token es unico: si otro usuario inicia sesion en el mismo celular, la fila se reasigna.
 */
@Entity('dispositivo_push')
export class DispositivoPush {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_usuario', type: 'int' })
  idUsuario: number;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Relation<Usuario>;

  @Column({ type: 'varchar', length: 255, unique: true })
  token: string;

  @Column({ type: 'varchar', length: 10 })
  plataforma: PlataformaPush;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ name: 'fecha_actualizacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaActualizacion: Date;
}

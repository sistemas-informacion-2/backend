import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Usuario } from '../../acceso/entities/usuario.entity.js';
import { Empresa } from '../../plataforma/entities/empresa.entity.js';
import { BiMensaje } from './bi-mensaje.entity.js';

/** Una conversacion con el asistente del BI. Pertenece a un usuario de una empresa. */
@Index('idx_bi_conversacion_usuario', ['idEmpresa', 'idUsuario', 'fechaActualizacion'])
@Entity('bi_conversacion')
export class BiConversacion {
  @PrimaryGeneratedColumn()
  id: number;

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

  @Column({ type: 'varchar', length: 100 })
  titulo: string;

  @Column({ name: 'fecha_creacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaCreacion: Date;

  @Column({ name: 'fecha_actualizacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaActualizacion: Date;

  @OneToMany(() => BiMensaje, (mensaje) => mensaje.conversacion)
  mensajes: Relation<BiMensaje>[];
}

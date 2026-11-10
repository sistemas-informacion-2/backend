import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type EstadoSolicitudIdempotente = 'EN_PROCESO' | 'COMPLETADA';

/** Escritura hecha sin conexion que ya llego al servidor: evita aplicarla dos veces si se reenvia. */
@Entity('solicitud_idempotente')
export class SolicitudIdempotente {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  clave: string;

  @Column({ name: 'id_usuario', type: 'int' })
  idUsuario: number;

  @Column({ type: 'varchar', length: 12 })
  estado: EstadoSolicitudIdempotente;

  @Column({ type: 'jsonb', nullable: true })
  respuesta: unknown;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' })
  fechaCreacion: Date;
}

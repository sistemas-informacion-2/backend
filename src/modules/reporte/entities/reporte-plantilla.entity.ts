import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Usuario } from '../../acceso/entities/usuario.entity.js';
import type { ReportRunRequestDto } from '../dto/reporte-builder.dto.js';

/**
 * Plantilla guardada de un reporte dinámico (CU18). Guarda la config completa
 * del Report Builder en `config` (jsonb) para poder reaplicarla con un clic.
 * La plantilla pertenece al usuario que la creó.
 */
@Entity('reporte_plantilla')
export class ReportePlantilla {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_usuario', type: 'int' })
  idUsuario: number;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Relation<Usuario>;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'jsonb' })
  config: ReportRunRequestDto;

  @Column({ name: 'fecha_creacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaCreacion: Date;

  @Column({
    name: 'fecha_actualizacion',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  fechaActualizacion: Date;
}
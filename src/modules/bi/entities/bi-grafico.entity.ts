import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Usuario } from '../../acceso/entities/usuario.entity.js';
import { Empresa } from '../../plataforma/entities/empresa.entity.js';

/**
 * Grafico guardado desde el asistente. No guarda datos ni como dibujarlo: solo que herramienta consultar y con que
 * parametros, asi al abrirlo se calcula otra vez con los datos del momento.
 */
@Index('idx_bi_grafico_usuario', ['idEmpresa', 'idUsuario', 'fechaCreacion'])
@Entity('bi_grafico')
export class BiGrafico {
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

  @Column({ type: 'varchar', length: 60 })
  herramienta: string;

  @Column({ type: 'jsonb' })
  parametros: Record<string, unknown>;

  @Column({ name: 'fecha_creacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaCreacion: Date;
}

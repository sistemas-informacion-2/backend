import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Empresa } from '../../plataforma/entities/empresa.entity.js';
import { BiConversacion } from './bi-conversacion.entity.js';

export type RolMensajeBi = 'USUARIO' | 'ASISTENTE';

/** Herramienta que uso el asistente para responder: lo que se muestra en "Como se calculo". No guarda los datos. */
export interface HerramientaUsada {
  nombre: string;
  parametros: Record<string, unknown>;
  ok: boolean;
}

@Index('idx_bi_mensaje_conversacion', ['idConversacion', 'id'])
@Index('idx_bi_mensaje_empresa_fecha', ['idEmpresa', 'fecha'])
@Entity('bi_mensaje')
export class BiMensaje {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_empresa', type: 'int' })
  idEmpresa: number;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Relation<Empresa>;

  @Column({ name: 'id_conversacion', type: 'int' })
  idConversacion: number;

  @ManyToOne(() => BiConversacion, (conversacion) => conversacion.mensajes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_conversacion' })
  conversacion: Relation<BiConversacion>;

  @Column({ type: 'varchar', length: 10 })
  rol: RolMensajeBi;

  @Column({ type: 'text' })
  contenido: string;

  @Column({ type: 'jsonb', nullable: true })
  herramientas: HerramientaUsada[] | null;

  /** Tokens que costo la respuesta, para vigilar el gasto en Gemini. */
  @Column({ name: 'tokens_entrada', type: 'int', nullable: true })
  tokensEntrada: number | null;

  @Column({ name: 'tokens_salida', type: 'int', nullable: true })
  tokensSalida: number | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha: Date;
}

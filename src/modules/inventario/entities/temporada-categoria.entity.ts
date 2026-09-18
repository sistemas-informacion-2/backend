import { Entity, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { Temporada } from './temporada.entity.js';
import { Categoria } from './categoria.entity.js';

@Entity('temporada_categoria')
export class TemporadaCategoria {
  @PrimaryColumn({ name: 'id_temporada' })
  idTemporada: number;

  @PrimaryColumn({ name: 'id_categoria' })
  idCategoria: number;

  @ManyToOne(() => Temporada, (temporada) => temporada.temporadasCategoria, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_temporada' })
  temporada: Relation<Temporada>;

  @ManyToOne(() => Categoria, (categoria) => categoria.temporadasCategoria, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_categoria' })
  categoria: Relation<Categoria>;
}

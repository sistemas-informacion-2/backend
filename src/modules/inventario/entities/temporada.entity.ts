import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Empresa } from '../../plataforma/entities/empresa.entity.js';
import { TemporadaCategoria } from './temporada-categoria.entity.js';

@Index('idx_temporada_empresa', ['idEmpresa'])
@Entity('temporada')
export class Temporada {
  @PrimaryGeneratedColumn()
  id: number;

  /** Empresa (tienda) duena del registro. */
  @Column({ name: 'id_empresa', type: 'int' })
  idEmpresa: number;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Relation<Empresa>;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: string;

  @Column({ name: 'fecha_fin', type: 'date' })
  fechaFin: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @OneToMany(() => TemporadaCategoria, (tc) => tc.temporada)
  temporadasCategoria: Relation<TemporadaCategoria>[];
}

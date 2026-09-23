import { Column, Entity, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { TemporadaCategoria } from './temporada-categoria.entity.js';

@Entity('temporada')
export class Temporada {
  @PrimaryGeneratedColumn()
  id: number;

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

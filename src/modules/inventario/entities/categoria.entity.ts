import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { TemporadaCategoria } from './temporada-categoria.entity.js';

@Entity('categoria')
export class Categoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_categoria_padre', type: 'int', nullable: true })
  idCategoriaPadre: number | null;

  @ManyToOne(() => Categoria, (categoria) => categoria.categoriasHijas, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'id_categoria_padre' })
  categoriaPadre: Relation<Categoria> | null;

  @OneToMany(() => Categoria, (categoria) => categoria.categoriaPadre)
  categoriasHijas: Relation<Categoria>[];

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ name: 'imagen_url', type: 'varchar', length: 500, nullable: true })
  imagenUrl: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @OneToMany(() => TemporadaCategoria, (tc) => tc.categoria)
  temporadasCategoria: Relation<TemporadaCategoria>[];
}

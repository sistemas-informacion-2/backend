import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Categoria } from './categoria.entity.js';
import { ImagenProducto } from './imagen-producto.entity.js';
import { VarianteProducto } from './variante-producto.entity.js';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';

/** Postgres devuelve NUMERIC como string para no perder precision; lo convertimos a number en ambos sentidos. */
const TRANSFORMER_DECIMAL = {
  to: (valor: number) => valor,
  from: (valor: string | null) => (valor === null ? null : Number(valor)),
};

@Entity('producto')
export class Producto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_categoria', type: 'int' })
  idCategoria: number;

  @ManyToOne(() => Categoria)
  @JoinColumn({ name: 'id_categoria' })
  categoria: Relation<Categoria>;

  @Column({ name: 'id_sucursal', type: 'int', nullable: true })
  idSucursal: number | null;

  @ManyToOne(() => Sucursal, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Relation<Sucursal> | null;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: TRANSFORMER_DECIMAL })
  precio: number;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @OneToMany(() => ImagenProducto, (imagen) => imagen.producto)
  imagenes: Relation<ImagenProducto>[];

  @OneToMany(() => VarianteProducto, (variante) => variante.producto)
  variantes: Relation<VarianteProducto>[];
}

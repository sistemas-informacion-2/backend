import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Empresa } from '../../plataforma/entities/empresa.entity.js';
import { Categoria } from './categoria.entity.js';
import { ImagenProducto } from './imagen-producto.entity.js';
import { VarianteProducto } from './variante-producto.entity.js';
import { ProductoSucursal } from './producto-sucursal.entity.js';

/** Postgres devuelve NUMERIC como string para no perder precision; lo convertimos a number en ambos sentidos. */
const TRANSFORMER_DECIMAL = {
  to: (valor: number) => valor,
  from: (valor: string | null) => (valor === null ? null : Number(valor)),
};

@Index('idx_producto_empresa', ['idEmpresa'])
@Entity('producto')
export class Producto {
  @PrimaryGeneratedColumn()
  id: number;

  /** Empresa (tienda) duena del registro. */
  @Column({ name: 'id_empresa', type: 'int' })
  idEmpresa: number;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Relation<Empresa>;

  @Column({ name: 'id_categoria', type: 'int' })
  idCategoria: number;

  @ManyToOne(() => Categoria)
  @JoinColumn({ name: 'id_categoria' })
  categoria: Relation<Categoria>;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: TRANSFORMER_DECIMAL })
  precio: number;

  /** Descuento vigente del producto en porcentaje (0 = sin descuento). */
  @Column({ name: 'descuento_porcentaje', type: 'decimal', precision: 5, scale: 2, default: 0, transformer: TRANSFORMER_DECIMAL })
  descuentoPorcentaje: number;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @OneToMany(() => ImagenProducto, (imagen) => imagen.producto)
  imagenes: Relation<ImagenProducto>[];

  @OneToMany(() => VarianteProducto, (variante) => variante.producto)
  variantes: Relation<VarianteProducto>[];

  @OneToMany(() => ProductoSucursal, (productoSucursal) => productoSucursal.producto)
  productoSucursales: Relation<ProductoSucursal>[];
}

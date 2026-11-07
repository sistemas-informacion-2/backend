import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Empresa } from '../../plataforma/entities/empresa.entity.js';
import { Producto } from './producto.entity.js';

/** Postgres devuelve NUMERIC como string; lo convertimos a number en ambos sentidos. */
const TRANSFORMER_DECIMAL = {
  to: (valor: number | null) => valor,
  from: (valor: string | null) => (valor === null ? null : Number(valor)),
};

@Index('uq_variante_empresa_sku', ['idEmpresa', 'sku'], { unique: true })
@Entity('variante_producto')
export class VarianteProducto {
  @PrimaryGeneratedColumn()
  id: number;

  /** Copia la empresa del producto: hace falta para que el SKU sea unico por empresa. */
  @Column({ name: 'id_empresa', type: 'int' })
  idEmpresa: number;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Relation<Empresa>;

  @Column({ name: 'id_producto', type: 'int' })
  idProducto: number;

  @ManyToOne(() => Producto, (producto) => producto.variantes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_producto' })
  producto: Relation<Producto>;

  @Column({ type: 'varchar', length: 100 })
  sku: string;

  @Column({ type: 'varchar', length: 20 })
  talla: string;

  @Column({ type: 'varchar', length: 50 })
  color: string;

  @Column({ type: 'varchar', length: 50 })
  corte: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  /**
   * Costo promedio ponderado de una unidad (compras y stock inicial, ver costo.util). null = todavia sin costo
   * conocido: las ventas de esa variante quedan sin costo y el margen no se puede calcular.
   */
  @Column({ name: 'costo_promedio', type: 'decimal', precision: 12, scale: 4, nullable: true, transformer: TRANSFORMER_DECIMAL })
  costoPromedio: number | null;
}

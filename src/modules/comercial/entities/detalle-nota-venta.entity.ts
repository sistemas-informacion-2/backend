import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { VarianteProducto } from '../../inventario/entities/variante-producto.entity.js';
import { NotaVenta } from './nota-venta.entity.js';

/** Postgres devuelve NUMERIC como string; lo convertimos a number en ambos sentidos. */
const TRANSFORMER_DECIMAL = {
  to: (valor: number) => valor,
  from: (valor: string | null) => (valor === null ? null : Number(valor)),
};

/** Línea de una nota de venta (CU12). */
@Entity('detalle_nota_venta')
export class DetalleNotaVenta {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_nota_venta', type: 'int' })
  idNotaVenta: number;

  @ManyToOne(() => NotaVenta, (nota) => nota.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_nota_venta' })
  notaVenta: Relation<NotaVenta>;

  @Column({ name: 'id_variante_producto', type: 'int', nullable: true })
  idVarianteProducto: number | null;

  @ManyToOne(() => VarianteProducto)
  @JoinColumn({ name: 'id_variante_producto' })
  variante: Relation<VarianteProducto> | null;

  @Column({ type: 'varchar', length: 255 })
  descripcion: string;

  /** Precio de lista del producto al vender (antes del descuento por producto). */
  @Column({ name: 'precio_lista', type: 'decimal', precision: 12, scale: 2, transformer: TRANSFORMER_DECIMAL })
  precioLista: number;

  /** Descuento por unidad del producto (precio_lista - precio_unitario). El descuento global de la nota va aparte. */
  @Column({ name: 'descuento_unitario', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: TRANSFORMER_DECIMAL })
  descuentoUnitario: number;

  /** Precio cobrado por unidad. */
  @Column({ name: 'precio_unitario', type: 'decimal', precision: 12, scale: 2, transformer: TRANSFORMER_DECIMAL })
  precioUnitario: number;

  /** Costo promedio de la variante al vender: base del margen. null = la variante no tenia costo conocido. */
  @Column({ name: 'costo_unitario', type: 'decimal', precision: 12, scale: 4, nullable: true, transformer: TRANSFORMER_DECIMAL })
  costoUnitario: number | null;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: TRANSFORMER_DECIMAL })
  subtotal: number;
}

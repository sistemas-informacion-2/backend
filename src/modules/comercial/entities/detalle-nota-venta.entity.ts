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

  @Column({ name: 'precio_unitario', type: 'decimal', precision: 12, scale: 2, transformer: TRANSFORMER_DECIMAL })
  precioUnitario: number;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: TRANSFORMER_DECIMAL })
  subtotal: number;
}

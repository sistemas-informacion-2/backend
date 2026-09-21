import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Almacen } from '../../inventario/entities/almacen.entity.js';
import { VarianteProducto } from '../../inventario/entities/variante-producto.entity.js';
import { NotaDevolucion } from './nota-devolucion.entity.js';

export type EstadoProductoDevolucion = 'REINGRESO_INVENTARIO' | 'MERMA_DEFECTUOSO' | 'NO_APLICA';

/** Postgres devuelve NUMERIC como string; lo convertimos a number en ambos sentidos. */
const TRANSFORMER_DECIMAL = {
  to: (valor: number) => valor,
  from: (valor: string | null) => (valor === null ? null : Number(valor)),
};

/** Línea de una devolución (CU24): qué prenda vuelve, a qué almacén y en qué estado. */
@Entity('detalle_nota_devolucion')
export class DetalleNotaDevolucion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_nota_devolucion', type: 'int' })
  idNotaDevolucion: number;

  @ManyToOne(() => NotaDevolucion, (nota) => nota.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_nota_devolucion' })
  notaDevolucion: Relation<NotaDevolucion>;

  @Column({ name: 'id_variante_producto', type: 'int', nullable: true })
  idVarianteProducto: number | null;

  @ManyToOne(() => VarianteProducto)
  @JoinColumn({ name: 'id_variante_producto' })
  variante: Relation<VarianteProducto> | null;

  @Column({ name: 'id_almacen', type: 'int', nullable: true })
  idAlmacen: number | null;

  @ManyToOne(() => Almacen)
  @JoinColumn({ name: 'id_almacen' })
  almacen: Relation<Almacen> | null;

  @Column({ type: 'varchar', length: 255 })
  descripcion: string;

  @Column({ name: 'precio_unitario', type: 'decimal', precision: 12, scale: 2, transformer: TRANSFORMER_DECIMAL })
  precioUnitario: number;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ name: 'monto_subtotal', type: 'decimal', precision: 12, scale: 2, transformer: TRANSFORMER_DECIMAL })
  montoSubtotal: number;

  @Column({
    name: 'estado_producto',
    type: 'enum',
    enum: ['REINGRESO_INVENTARIO', 'MERMA_DEFECTUOSO', 'NO_APLICA'],
    enumName: 'estado_producto_devolucion_enum',
    default: 'REINGRESO_INVENTARIO',
  })
  estadoProducto: EstadoProductoDevolucion;
}

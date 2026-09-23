import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { VarianteProducto } from '../../inventario/entities/variante-producto.entity.js';
import { Almacen } from '../../inventario/entities/almacen.entity.js';
import { NotaCompra } from './nota-compra.entity.js';

@Entity('detalle_nota_compra')
export class DetalleNotaCompra {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_nota_compra', type: 'int' })
  idNotaCompra: number;

  @ManyToOne(() => NotaCompra, (nota) => nota.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_nota_compra' })
  notaCompra: Relation<NotaCompra>;

  @Column({ name: 'id_variante_producto', type: 'int' })
  idVarianteProducto: number;

  @ManyToOne(() => VarianteProducto)
  @JoinColumn({ name: 'id_variante_producto' })
  variante: Relation<VarianteProducto>;

  @Column({ name: 'id_almacen', type: 'int' })
  idAlmacen: number;

  @ManyToOne(() => Almacen)
  @JoinColumn({ name: 'id_almacen' })
  almacen: Relation<Almacen>;

  @Column({ name: 'precio_unitario', type: 'decimal', precision: 12, scale: 2 })
  precioUnitario: string;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: string;

  @Column({ name: 'nro_lote', type: 'varchar', length: 50, nullable: true })
  nroLote: string | null;
}

import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, type Relation } from 'typeorm';
import { VarianteProducto } from '../../inventario/entities/variante-producto.entity.js';
import { Carrito } from './carrito.entity.js';

@Entity('detalle_carrito')
@Unique('uq_carrito_variante', ['idCarrito', 'idVarianteProducto'])
export class DetalleCarrito {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_carrito', type: 'int' })
  idCarrito: number;

  @ManyToOne(() => Carrito, (carrito) => carrito.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_carrito' })
  carrito: Relation<Carrito>;

  @Column({ name: 'id_variante_producto', type: 'int' })
  idVarianteProducto: number;

  @ManyToOne(() => VarianteProducto)
  @JoinColumn({ name: 'id_variante_producto' })
  variante: Relation<VarianteProducto>;

  /** Precio con descuento al momento de agregar/modificar; la respuesta usa el precio vigente del producto. */
  @Column({ name: 'precio_unitario', type: 'decimal', precision: 12, scale: 2 })
  precioUnitario: string;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: string;

  @Column({ name: 'notas_especiales', type: 'text', nullable: true })
  notasEspeciales: string | null;

  @Column({ name: 'fecha_agregado', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaAgregado: Date;
}

import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { Producto } from './producto.entity.js';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';

/** Activación por sucursal de un producto global: el catálogo (PRODUCTO) no se duplica por sede. */
@Entity('producto_sucursal')
export class ProductoSucursal {
  @PrimaryColumn({ name: 'id_producto' })
  idProducto: number;

  @PrimaryColumn({ name: 'id_sucursal' })
  idSucursal: number;

  @ManyToOne(() => Producto, (producto) => producto.productoSucursales, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_producto' })
  producto: Relation<Producto>;

  @ManyToOne(() => Sucursal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Relation<Sucursal>;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}

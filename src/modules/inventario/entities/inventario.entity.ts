import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, type Relation } from 'typeorm';
import { Almacen } from './almacen.entity.js';
import { VarianteProducto } from './variante-producto.entity.js';

/**
 * Existencias de una variante en un almacen (CU07). Una fila por
 * (almacen, variante). `stockReservado` lo consumiran carrito/ventas (CU13/CU12)
 * y no se edita manualmente.
 */
@Entity('inventario')
@Unique('uq_almacen_variante', ['idAlmacen', 'idVarianteProducto'])
export class Inventario {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_almacen', type: 'int' })
  idAlmacen: number;

  @ManyToOne(() => Almacen, (almacen) => almacen.inventarios, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_almacen' })
  almacen: Relation<Almacen>;

  @Column({ name: 'id_variante_producto', type: 'int' })
  idVarianteProducto: number;

  @ManyToOne(() => VarianteProducto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_variante_producto' })
  variante: Relation<VarianteProducto>;

  @Column({ name: 'stock_disponible', type: 'int', default: 0 })
  stockDisponible: number;

  @Column({ name: 'stock_reservado', type: 'int', default: 0 })
  stockReservado: number;

  @Column({ name: 'stock_minimo', type: 'int', default: 5 })
  stockMinimo: number;

  @Column({ name: 'stock_maximo', type: 'int', default: 500 })
  stockMaximo: number;
}

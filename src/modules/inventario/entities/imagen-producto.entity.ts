import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Producto } from './producto.entity.js';

@Entity('imagen_producto')
export class ImagenProducto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_producto', type: 'int' })
  idProducto: number;

  @ManyToOne(() => Producto, (producto) => producto.imagenes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_producto' })
  producto: Relation<Producto>;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ name: 'es_principal', type: 'boolean', default: false })
  esPrincipal: boolean;

  @Column({ type: 'int', default: 1 })
  orden: number;
}

import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Producto } from './producto.entity.js';

@Entity('variante_producto')
export class VarianteProducto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_producto', type: 'int' })
  idProducto: number;

  @ManyToOne(() => Producto, (producto) => producto.variantes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_producto' })
  producto: Relation<Producto>;

  @Column({ type: 'varchar', length: 100, unique: true })
  sku: string;

  @Column({ type: 'varchar', length: 20 })
  talla: string;

  @Column({ type: 'varchar', length: 50 })
  color: string;

  @Column({ type: 'varchar', length: 50 })
  corte: string;

  @Column({ name: 'codigo_hex_color', type: 'varchar', length: 10, nullable: true })
  codigoHexColor: string | null;

  @Column({ name: 'modelo_3d_url', type: 'varchar', length: 500, nullable: true })
  modelo3dUrl: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}

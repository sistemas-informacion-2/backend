import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Empresa } from '../../plataforma/entities/empresa.entity.js';
import { Producto } from './producto.entity.js';

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
}

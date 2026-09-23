import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';
import { Inventario } from './inventario.entity.js';

/**
 * Almacen fisico o deposito de una sucursal (CU07). Concentra las existencias
 * (INVENTARIO) de las variantes de producto.
 */
@Entity('almacen')
export class Almacen {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_sucursal', type: 'int' })
  idSucursal: number;

  @ManyToOne(() => Sucursal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Relation<Sucursal>;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ name: 'ubicacion_fisica', type: 'text', nullable: true })
  ubicacionFisica: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @OneToMany(() => Inventario, (inventario) => inventario.almacen)
  inventarios: Relation<Inventario>[];
}

import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Cliente } from '../../operaciones/entities/cliente.entity.js';
import { DetalleCarrito } from './detalle-carrito.entity.js';

/** Carrito virtual del cliente (CU14): uno por cliente, con sus items en DETALLE_CARRITO. */
@Entity('carrito')
export class Carrito {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_cliente', type: 'int', unique: true })
  idCliente: number;

  @ManyToOne(() => Cliente, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_cliente' })
  cliente: Relation<Cliente>;

  @Column({ name: 'session_id', type: 'varchar', length: 100, nullable: true })
  sessionId: string | null;

  @Column({ name: 'fecha_creacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaCreacion: Date;

  @Column({ name: 'fecha_actualizacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaActualizacion: Date;

  @OneToMany(() => DetalleCarrito, (detalle) => detalle.carrito)
  detalles: Relation<DetalleCarrito>[];
}

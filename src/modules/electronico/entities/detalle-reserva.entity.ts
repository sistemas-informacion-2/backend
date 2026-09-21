import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { VarianteProducto } from '../../inventario/entities/variante-producto.entity.js';
import { Reserva } from './reserva.entity.js';

/** Postgres devuelve NUMERIC como string; lo convertimos a number en ambos sentidos. */
const TRANSFORMER_DECIMAL = {
  to: (valor: number) => valor,
  from: (valor: string | null) => (valor === null ? null : Number(valor)),
};

/** Línea de una reserva (CU23). */
@Entity('detalle_reserva')
export class DetalleReserva {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_reserva', type: 'int' })
  idReserva: number;

  @ManyToOne(() => Reserva, (reserva) => reserva.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_reserva' })
  reserva: Relation<Reserva>;

  @Column({ name: 'id_variante_producto', type: 'int' })
  idVarianteProducto: number;

  @ManyToOne(() => VarianteProducto)
  @JoinColumn({ name: 'id_variante_producto' })
  variante: Relation<VarianteProducto>;

  @Column({ name: 'precio_unitario', type: 'decimal', precision: 12, scale: 2, transformer: TRANSFORMER_DECIMAL })
  precioUnitario: number;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: TRANSFORMER_DECIMAL })
  subtotal: number;
}

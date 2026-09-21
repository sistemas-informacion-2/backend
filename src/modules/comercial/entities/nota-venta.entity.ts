import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Cliente } from '../../operaciones/entities/cliente.entity.js';
import { Empleado } from '../../operaciones/entities/empleado.entity.js';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';
import { Carrito } from '../../electronico/entities/carrito.entity.js';
import { Reserva } from '../../electronico/entities/reserva.entity.js';
import { PasarelaPago } from './pasarela-pago.entity.js';
import { MovimientoCaja } from './movimiento-caja.entity.js';
import { DetalleNotaVenta } from './detalle-nota-venta.entity.js';
import { Pago } from './pago.entity.js';

export type TipoNotaVenta =
  | 'DIRECTA_PRESENCIAL'
  | 'ANTICIPO_RESERVA'
  | 'PRESENCIAL_LIQUIDACION'
  | 'E_COMMERCE';

/** Postgres devuelve NUMERIC como string; lo convertimos a number en ambos sentidos. */
const TRANSFORMER_DECIMAL = {
  to: (valor: number) => valor,
  from: (valor: string | null) => (valor === null ? null : Number(valor)),
};

/**
 * Nota de venta presencial (CU12). Su pago se imputa a un `movimiento_caja` de la
 * caja abierta (CU15) y descuenta existencias del almacén elegido en el momento
 * de la venta.
 */
@Entity('nota_venta')
export class NotaVenta {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'codigo_nota', type: 'varchar', length: 20, unique: true })
  codigoNota: string;

  @Column({ name: 'id_cliente', type: 'int' })
  idCliente: number;

  @ManyToOne(() => Cliente)
  @JoinColumn({ name: 'id_cliente' })
  cliente: Relation<Cliente>;

  @Column({ name: 'id_cajero', type: 'int', nullable: true })
  idCajero: number | null;

  @ManyToOne(() => Empleado)
  @JoinColumn({ name: 'id_cajero' })
  cajero: Relation<Empleado> | null;

  @Column({ name: 'id_sucursal', type: 'int' })
  idSucursal: number;

  @ManyToOne(() => Sucursal)
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Relation<Sucursal>;

  @Column({ name: 'id_pasarela', type: 'int', nullable: true })
  idPasarela: number | null;

  @ManyToOne(() => PasarelaPago)
  @JoinColumn({ name: 'id_pasarela' })
  pasarela: Relation<PasarelaPago> | null;

  @Column({ name: 'id_movimiento_caja', type: 'int', nullable: true })
  idMovimientoCaja: number | null;

  @ManyToOne(() => MovimientoCaja)
  @JoinColumn({ name: 'id_movimiento_caja' })
  movimientoCaja: Relation<MovimientoCaja> | null;

  /** Carrito del que salió la compra e-commerce (CU14); se anula si el carrito se elimina. */
  @Column({ name: 'id_carrito', type: 'int', nullable: true })
  idCarrito: number | null;

  @ManyToOne(() => Carrito, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_carrito' })
  carrito: Relation<Carrito> | null;

  /** Reserva liquidada que originó esta nota (CU23). */
  @Column({ name: 'id_reserva', type: 'int', nullable: true })
  idReserva: number | null;

  @ManyToOne(() => Reserva, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_reserva' })
  reserva: Relation<Reserva> | null;

  @Column({ type: 'varchar', length: 30, default: 'PRESENCIAL' })
  tipo: string;

  @Column({ name: 'tipo_venta', type: 'enum', enum: ['DIRECTA_PRESENCIAL', 'ANTICIPO_RESERVA', 'PRESENCIAL_LIQUIDACION', 'E_COMMERCE'], enumName: 'tipo_nota_venta_enum' })
  tipoVenta: TipoNotaVenta;

  @Column({ name: 'nro_factura', type: 'varchar', length: 50, nullable: true, unique: true })
  nroFactura: string | null;

  @Column({ name: 'nit_razon_social', type: 'varchar', length: 50, nullable: true })
  nitRazonSocial: string | null;

  @Column({ name: 'fecha_emision', type: 'date' })
  fechaEmision: string;

  @Column({ name: 'hora_emision', type: 'time' })
  horaEmision: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: TRANSFORMER_DECIMAL })
  subtotal: number;

  @Column({ name: 'monto_anticipo_aplicado', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: TRANSFORMER_DECIMAL })
  montoAnticipoAplicado: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: TRANSFORMER_DECIMAL })
  descuento: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: TRANSFORMER_DECIMAL })
  impuesto: number;

  @Column({ name: 'monto_total', type: 'decimal', precision: 12, scale: 2, transformer: TRANSFORMER_DECIMAL })
  montoTotal: number;

  @Column({ name: 'estado_pago', type: 'varchar', length: 30, default: 'Pagado' })
  estadoPago: string;

  @OneToMany(() => DetalleNotaVenta, (detalle) => detalle.notaVenta)
  detalles: Relation<DetalleNotaVenta>[];

  @OneToMany(() => Pago, (pago) => pago.notaVenta)
  pagos: Relation<Pago>[];
}

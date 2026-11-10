import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Empresa } from './empresa.entity.js';
import { Plan } from './plan.entity.js';

/** ALTA = registro de una empresa nueva; RENOVACION = otro periodo del mismo plan; CAMBIO_PLAN = paso a otro plan. */
export type TipoPagoPlan = 'ALTA' | 'RENOVACION' | 'CAMBIO_PLAN';
export type EstadoPagoPlan = 'PENDIENTE' | 'PAGADO' | 'FALLIDO';

const TRANSFORMER_DECIMAL = {
  to: (valor: number | null) => valor,
  from: (valor: string | null) => (valor === null ? null : Number(valor)),
};

/** Datos del formulario de registro que esperan la confirmacion del pago (la contrasena ya va cifrada). */
export interface DatosRegistroPendiente {
  slug: string;
  nombre: string;
  razonSocial: string;
  nit: string;
  pais: string;
  ciudad: string;
  direccion: string | null;
  telefono: string | null;
  admin: { nombre: string; apellido: string; email: string; telefono: string | null; passwordHash: string };
}

/**
 * Cada cobro de un plan de DOMINATR. En un ALTA la empresa todavia no existe: la fila guarda los datos del
 * registro hasta que Stripe confirma el pago, y recien ahi se crea la empresa (id_empresa queda asignado).
 * La confirmacion es idempotente: una fila PAGADO no se vuelve a procesar.
 */
@Index('idx_pago_plan_empresa', ['idEmpresa', 'fechaCreacion'])
@Entity('pago_plan')
export class PagoPlan {
  @PrimaryGeneratedColumn()
  id: number;

  /** null mientras el ALTA espera el pago. */
  @Column({ name: 'id_empresa', type: 'int', nullable: true })
  idEmpresa: number | null;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Relation<Empresa> | null;

  @Column({ name: 'id_plan', type: 'int' })
  idPlan: number;

  @ManyToOne(() => Plan)
  @JoinColumn({ name: 'id_plan' })
  plan: Relation<Plan>;

  @Column({ type: 'varchar', length: 20 })
  tipo: TipoPagoPlan;

  @Column({ type: 'varchar', length: 20, default: 'PENDIENTE' })
  estado: EstadoPagoPlan;

  /** Monto en Bs (Stripe cobra su equivalente en la moneda configurada). */
  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: TRANSFORMER_DECIMAL })
  monto: number;

  @Column({ name: 'stripe_session_id', type: 'varchar', length: 255, nullable: true, unique: true })
  stripeSessionId: string | null;

  @Column({ name: 'stripe_payment_intent_id', type: 'varchar', length: 255, nullable: true })
  stripePaymentIntentId: string | null;

  /** Solo en ALTA: lo que se lleno en el registro. Se borra la contrasena al confirmar. */
  @Column({ name: 'datos_registro', type: 'jsonb', nullable: true })
  datosRegistro: DatosRegistroPendiente | null;

  /** Quien pidio la renovacion o el cambio de plan (null en un ALTA). */
  @Column({ name: 'id_usuario', type: 'int', nullable: true })
  idUsuario: number | null;

  @Column({ name: 'periodo_desde', type: 'timestamp', nullable: true })
  periodoDesde: Date | null;

  @Column({ name: 'periodo_hasta', type: 'timestamp', nullable: true })
  periodoHasta: Date | null;

  @Column({ name: 'detalle_error', type: 'varchar', length: 255, nullable: true })
  detalleError: string | null;

  @Column({ name: 'fecha_creacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaCreacion: Date;

  @Column({ name: 'fecha_pago', type: 'timestamp', nullable: true })
  fechaPago: Date | null;
}

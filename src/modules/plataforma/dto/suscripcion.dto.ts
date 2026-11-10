import type { EstadoVigencia } from '../../../common/tenant/plan-vigencia.js';
import type { UsoPlan } from '../../../common/tenant/limites-plan.service.js';
import type { EstadoPagoPlan, TipoPagoPlan } from '../entities/pago-plan.entity.js';
import type { PlanResponseDto } from './plan.dto.js';

export interface PagoPlanResponseDto {
  id: number;
  tipo: TipoPagoPlan;
  estado: EstadoPagoPlan;
  monto: number;
  planNombre: string;
  periodoDesde: Date | null;
  periodoHasta: Date | null;
  fechaCreacion: Date;
  fechaPago: Date | null;
}

/** Pantalla Mi plan: el plan de la tienda, su vigencia, lo que ya usa y los ultimos pagos. */
export interface MiPlanResponseDto {
  plan: PlanResponseDto;
  venceEl: Date | null;
  vigencia: EstadoVigencia;
  /** Hasta cuando opera la tienda si no renueva (vencimiento + gracia). */
  finDeGracia: Date | null;
  /** Dias enteros hasta el vencimiento (negativo si ya vencio); null si no vence. */
  diasRestantes: number | null;
  uso: UsoPlan;
  /** Solo el administrador (tipo A) renueva o cambia el plan. */
  puedeGestionar: boolean;
  pagos: PagoPlanResponseDto[];
}

export interface IniciarPagoResponseDto {
  urlPago: string;
  /** Monto en Bs y su equivalente que cobra Stripe. */
  montoBob: number;
  montoCobrado: number;
  monedaCobro: string;
}

export interface PagoConfirmadoResponseDto {
  codigoPlan: string;
  planNombre: string;
  venceEl: Date | null;
}

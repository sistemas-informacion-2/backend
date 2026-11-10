import type { Plan } from '../entities/plan.entity.js';
import type { PagoPlan } from '../entities/pago-plan.entity.js';
import type { PlanResponseDto } from '../dto/plan.dto.js';
import type { PagoPlanResponseDto } from '../dto/suscripcion.dto.js';

export function toPlanResponse(plan: Plan): PlanResponseDto {
  return {
    codigo: plan.codigo,
    nombre: plan.nombre,
    descripcion: plan.descripcion,
    precio: plan.precio,
    duracionDias: plan.duracionDias,
    maxUsuarios: plan.maxUsuarios,
    maxSucursales: plan.maxSucursales,
    maxAlmacenes: plan.maxAlmacenes,
    reportesAvanzados: plan.reportesAvanzados,
    bi: plan.bi,
    esPrueba: plan.esPrueba,
    destacado: plan.destacado,
    capacidades: plan.capacidades,
  };
}

/** `pago.plan` tiene que venir cargado. */
export function toPagoPlanResponse(pago: PagoPlan): PagoPlanResponseDto {
  return {
    id: pago.id,
    tipo: pago.tipo,
    estado: pago.estado,
    monto: pago.monto,
    planNombre: pago.plan.nombre,
    periodoDesde: pago.periodoDesde,
    periodoHasta: pago.periodoHasta,
    fechaCreacion: pago.fechaCreacion,
    fechaPago: pago.fechaPago,
  };
}

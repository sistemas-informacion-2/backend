import { IsIn } from 'class-validator';
import type { CodigoPlan } from '../entities/plan.entity.js';

export const CODIGOS_PLAN: CodigoPlan[] = ['PRUEBA', 'EMPRENDEDOR', 'PROFESIONAL', 'EMPRESARIAL'];

/** Lo que muestra la tarjeta de un plan (landing, registro y Mi plan). */
export interface PlanResponseDto {
  codigo: CodigoPlan;
  nombre: string;
  descripcion: string;
  /** En Bs por periodo. */
  precio: number;
  duracionDias: number;
  maxUsuarios: number | null;
  maxSucursales: number | null;
  maxAlmacenes: number | null;
  reportesAvanzados: boolean;
  bi: boolean;
  esPrueba: boolean;
  destacado: boolean;
  capacidades: string[];
}

/** Pagar un periodo: del mismo plan (renovacion) o de otro (cambio de plan). */
export class PagarPlanDto {
  @IsIn(CODIGOS_PLAN, { message: 'El plan indicado no existe' })
  codigoPlan: CodigoPlan;
}

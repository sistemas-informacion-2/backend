import { SetMetadata } from '@nestjs/common';
import type { FuncionPlan } from '../../modules/plataforma/entities/plan.entity.js';

export const PERMITIDO_SIN_PLAN = 'permitidoSinPlan';
export const REQUIERE_PLAN = 'requierePlan';

/**
 * La ruta sigue abierta aunque el plan de la tienda haya vencido (pasada la gracia): login, sesion y Mi plan,
 * para que el dueno pueda entrar y renovar. Ver TenantGuard.
 */
export const PermitidoSinPlan = () => SetMetadata(PERMITIDO_SIN_PLAN, true);

/** La ruta solo funciona si el plan de la tienda incluye la funcion (403 PLAN_SIN_FUNCION si no). Ver TenantGuard. */
export const RequierePlan = (funcion: FuncionPlan) => SetMetadata(REQUIERE_PLAN, funcion);

/** Nombre de cada funcion para los mensajes al usuario. */
export const NOMBRE_FUNCION: Record<FuncionPlan, string> = {
  reportesAvanzados: 'el constructor de reportes y los reportes generativos',
  bi: 'el BI con inteligencia artificial',
};

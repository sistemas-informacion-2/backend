import { ahora } from '../utils/reloj.js';

/** Dias que la tienda sigue operando despues de vencer el plan, para que alcance a renovar. */
export const DIAS_GRACIA = 3;
/** Desde cuantos dias antes del vencimiento se avisa en el panel. */
export const DIAS_AVISO = 3;

const DIA_MS = 86_400_000;

/**
 * SIN_VENCIMIENTO: tiendas internas o de cortesia. VIGENTE: pagado. POR_VENCER: faltan DIAS_AVISO o menos.
 * EN_GRACIA: vencio hace menos de DIAS_GRACIA (sigue operando). VENCIDO: solo se abre Mi plan.
 */
export type EstadoVigencia = 'SIN_VENCIMIENTO' | 'VIGENTE' | 'POR_VENCER' | 'EN_GRACIA' | 'VENCIDO';

export function estadoVigencia(venceEl: Date | null, momento: Date = ahora()): EstadoVigencia {
  if (!venceEl) return 'SIN_VENCIMIENTO';
  const resta = new Date(venceEl).getTime() - momento.getTime();
  if (resta > DIAS_AVISO * DIA_MS) return 'VIGENTE';
  if (resta > 0) return 'POR_VENCER';
  if (resta > -DIAS_GRACIA * DIA_MS) return 'EN_GRACIA';
  return 'VENCIDO';
}

/** Ultimo momento en que la tienda opera: el vencimiento mas la gracia. */
export function finDeGracia(venceEl: Date): Date {
  return new Date(new Date(venceEl).getTime() + DIAS_GRACIA * DIA_MS);
}

export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * DIA_MS);
}

/**
 * Desde cuando corre un periodo nuevo: si el plan aun no vencio, se suma al final (no se pierden dias pagados);
 * si ya vencio o no tiene vencimiento, desde ahora.
 */
export function inicioDeNuevoPeriodo(venceEl: Date | null, momento: Date = ahora()): Date {
  if (venceEl && new Date(venceEl).getTime() > momento.getTime()) return new Date(venceEl);
  return momento;
}

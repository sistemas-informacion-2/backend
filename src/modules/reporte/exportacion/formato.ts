/**
 * Formatos en espanol de Bolivia para el PDF, el Excel y las frases del analisis: "Bs 1.234,56", "1.234", "32,4 %".
 * Igual que el frontend (formatearMonto en frontend/src/modules/reporte/utils/format.ts).
 */
const MONEDA = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NUMERO = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 });
const PORCENTAJE = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function formatearBs(valor: number): string {
  return `Bs ${MONEDA.format(valor)}`;
}

export function formatearNumero(valor: number): string {
  return NUMERO.format(valor);
}

/** 0.324 → "32,4 %". */
export function formatearPorcentaje(fraccion: number): string {
  return `${PORCENTAJE.format(fraccion * 100)} %`;
}

/** "2026-10" → "octubre de 2026". */
export function nombreDeMes(mes: string): string {
  const [anio, numero] = mes.split('-').map(Number);
  return `${MESES[numero - 1] ?? mes} de ${anio}`;
}

/** "2026-10" → "oct. 2026" (para ejes de graficos). */
export function mesCorto(mes: string): string {
  const [anio, numero] = mes.split('-').map(Number);
  const nombre = MESES[numero - 1];
  return nombre ? `${nombre.slice(0, 3)}. ${anio}` : mes;
}

/** "2026-11-13" → "13/11/2026". */
export function fechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

/** "A", "A y B", "A, B y C". */
export function enumerar(nombres: string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? '';
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

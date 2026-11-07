/**
 * Fechas y horas del negocio, siempre en la zona de Bolivia: una venta de las
 * 21:00 en La Paz es de ese dia aunque en UTC ya sea el siguiente. Usa Intl
 * con la zona explicita, asi que no depende del reloj del servidor.
 *
 * La aritmetica de dias trabaja sobre la fecha de calendario (AAAA-MM-DD), sin
 * husos, para que sumar o restar dias nunca se corra por el cambio de zona.
 */
export const ZONA_HORARIA = 'America/La_Paz';

const FORMATO_FECHA = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const FORMATO_HORA = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA_HORARIA,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Fecha de calendario en Bolivia: 'AAAA-MM-DD'. */
export function fechaLocal(fecha: Date = new Date()): string {
  return FORMATO_FECHA.format(fecha);
}

/** Hora en Bolivia: 'HH:mm:ss' (00-23). */
export function horaLocal(fecha: Date = new Date()): string {
  return FORMATO_HORA.format(fecha);
}

/**
 * Fecha 'AAAA-MM-DD' de un Date que armo el driver de Postgres: para columnas `date` y `timestamp` (sin zona) pg
 * construye el Date con componentes locales del proceso, asi que se leen esos mismos componentes. No usar con
 * "ahora" (para eso, fechaLocal).
 */
export function fechaDeColumna(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Suma (o resta, con negativos) dias a una fecha 'AAAA-MM-DD'. */
export function sumarDias(fechaIso: string, dias: number): string {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** Suma (o resta) meses; si el dia no existe en el mes destino, toma el ultimo dia de ese mes. */
export function sumarMeses(fechaIso: string, meses: number): string {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  const ultimoDiaDestino = new Date(Date.UTC(anio, mes - 1 + meses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(anio, mes - 1 + meses, Math.min(dia, ultimoDiaDestino))).toISOString().slice(0, 10);
}

/** Primer dia del mes de una fecha 'AAAA-MM-DD'. */
export function inicioDeMes(fechaIso: string): string {
  return `${fechaIso.slice(0, 7)}-01`;
}

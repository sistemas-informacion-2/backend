/**
 * Hora "actual" del negocio. En la app siempre es la real; solo el generador de historia de demostracion
 * (`npm run seed:historico`) la adelanta para registrar ventas, compras y reservas de meses pasados usando los mismos
 * services. Nunca se puede simular en produccion.
 *
 * Es una funcion y no un provider: la usan services, utilidades de fecha y el subscriber de fechas por defecto, y
 * asi no cambia ningun constructor.
 */
let simulada: number | null = null;

export function ahora(): Date {
  return new Date(simulada ?? Date.now());
}

export function relojSimulado(): boolean {
  return simulada !== null;
}

/** Fija la hora simulada (o vuelve a la real con null). */
export function fijarReloj(fecha: Date | null): void {
  if (fecha !== null && process.env.NODE_ENV === 'production') {
    throw new Error('El reloj simulado no esta permitido en produccion');
  }
  if (fecha !== null && Number.isNaN(fecha.getTime())) throw new Error('Fecha invalida para el reloj simulado');
  simulada = fecha === null ? null : fecha.getTime();
}

/**
 * AAAA-MM-DD en la hora LOCAL del servidor (America/La_Paz), la misma con la que se guarda
 * nota_venta.fecha_emision. No usar toISOString(): da la fecha UTC, que desde las 20:00 en
 * Bolivia ya es el dia siguiente y deja vacio "hoy".
 */
export function fechaLocal(fecha: Date = new Date()): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Precio de venta con el descuento porcentual del producto ya aplicado, a 2 decimales. */
export function precioConDescuento(precio: number, descuentoPorcentaje: number): number {
  return Math.round((precio * (1 - descuentoPorcentaje / 100) + Number.EPSILON) * 100) / 100;
}

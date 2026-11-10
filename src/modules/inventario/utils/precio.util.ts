/** Precio de venta con el descuento porcentual del producto ya aplicado, a 2 decimales. */
export function precioConDescuento(precio: number, descuentoPorcentaje: number): number {
  return Math.round((precio * (1 - descuentoPorcentaje / 100) + Number.EPSILON) * 100) / 100;
}

/** Lo que se guarda en cada linea vendida: el precio de lista, cuanto se desconto y lo que se cobro. */
export interface PrecioVenta {
  precioLista: number;
  descuentoUnitario: number;
  precioUnitario: number;
}

/** Precio de venta de una unidad segun el precio y el descuento vigentes del producto (todos los canales). */
export function calcularPrecioVenta(precio: number, descuentoPorcentaje: number | null | undefined): PrecioVenta {
  const precioLista = Math.round((precio + Number.EPSILON) * 100) / 100;
  const precioUnitario = precioConDescuento(precioLista, Number(descuentoPorcentaje ?? 0));
  return { precioLista, precioUnitario, descuentoUnitario: Math.round((precioLista - precioUnitario + Number.EPSILON) * 100) / 100 };
}

import { precioConDescuento } from '../../inventario/utils/precio.util.js';
import type { Carrito } from '../entities/carrito.entity.js';
import type { DetalleCarrito } from '../entities/detalle-carrito.entity.js';
import type { CarritoResponseDto, ItemCarritoResponseDto } from '../dto/carrito.dto.js';

function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function toItemResponseDto(detalle: DetalleCarrito, stock: Map<number, number>): ItemCarritoResponseDto {
  const variante = detalle.variante;
  const producto = variante?.producto;
  const stockDisponible = stock.get(detalle.idVarianteProducto) ?? 0;

  // Se usa el precio vigente del producto, no el guardado: asi el carrito nunca muestra un precio viejo.
  const precioUnitario = producto ? precioConDescuento(producto.precio, producto.descuentoPorcentaje) : Number(detalle.precioUnitario);
  const imagenes = producto?.imagenes ?? [];
  const imagen = imagenes.find((candidata) => candidata.esPrincipal) ?? [...imagenes].sort((a, b) => a.orden - b.orden)[0];

  return {
    id: detalle.id,
    idVarianteProducto: detalle.idVarianteProducto,
    idProducto: variante?.idProducto ?? 0,
    productoNombre: producto?.nombre ?? '',
    sku: variante?.sku ?? '',
    talla: variante?.talla ?? '',
    color: variante?.color ?? '',
    corte: variante?.corte ?? '',
    imagenUrl: imagen?.url ?? null,
    precioUnitario,
    cantidad: detalle.cantidad,
    subtotal: redondear(precioUnitario * detalle.cantidad),
    notasEspeciales: detalle.notasEspeciales,
    stockDisponible,
    disponible: !!variante?.activo && !!producto?.activo && stockDisponible >= detalle.cantidad,
  };
}

export function toCarritoResponseDto(carrito: Carrito | null, stock: Map<number, number>): CarritoResponseDto {
  if (!carrito) return { id: null, items: [], cantidadTotal: 0, total: 0, fechaActualizacion: null };

  const items = (carrito.detalles ?? []).map((detalle) => toItemResponseDto(detalle, stock)).sort((a, b) => a.id - b.id);

  return {
    id: carrito.id,
    items,
    cantidadTotal: items.reduce((suma, item) => suma + item.cantidad, 0),
    total: redondear(items.reduce((suma, item) => suma + item.subtotal, 0)),
    fechaActualizacion: carrito.fechaActualizacion,
  };
}

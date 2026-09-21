import type { NotaCompra } from '../entities/nota-compra.entity.js';
import type { DetalleNotaCompra } from '../entities/detalle-nota-compra.entity.js';
import type { CompraResponseDto, DetalleCompraResponseDto } from '../dto/compra-response.dto.js';

export function toDetalleCompraResponseDto(detalle: DetalleNotaCompra): DetalleCompraResponseDto {
  return {
    id: detalle.id,
    idVarianteProducto: detalle.idVarianteProducto,
    sku: detalle.variante?.sku ?? '',
    productoNombre: detalle.variante?.producto?.nombre ?? '',
    talla: detalle.variante?.talla ?? '',
    color: detalle.variante?.color ?? '',
    idAlmacen: detalle.idAlmacen,
    almacenNombre: detalle.almacen?.nombre ?? '',
    precioUnitario: Number(detalle.precioUnitario),
    cantidad: detalle.cantidad,
    subtotal: Number(detalle.subtotal),
    nroLote: detalle.nroLote,
  };
}

/** En los listados solo se cuenta las lineas (`incluirDetalles: false`); el detalle de una compra las trae completas. */
export function toCompraResponseDto(compra: NotaCompra, { incluirDetalles = true } = {}): CompraResponseDto {
  const lineas = compra.detalles ?? [];
  const detalles = incluirDetalles ? lineas.map(toDetalleCompraResponseDto).sort((a, b) => a.id - b.id) : [];

  return {
    id: compra.id,
    idProveedor: compra.idProveedor,
    proveedorNombre: compra.proveedor?.empresa ?? '',
    idSucursal: compra.idSucursal,
    sucursalNombre: compra.sucursal?.nombre ?? '',
    idMovimientoCaja: compra.idMovimientoCaja,
    nroFactura: compra.nroFactura,
    fechaEmision: compra.fechaEmision,
    fechaEntregaProgramada: compra.fechaEntregaProgramada,
    fechaPago: compra.fechaPago,
    subtotal: Number(compra.subtotal),
    total: Number(compra.total),
    estado: compra.estado,
    cantidadLineas: lineas.length,
    detalles,
  };
}

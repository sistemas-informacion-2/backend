import type { NotaDevolucion } from '../entities/nota-devolucion.entity.js';
import type { DetalleNotaDevolucion } from '../entities/detalle-nota-devolucion.entity.js';
import type { DetalleDevolucionResponseDto, DevolucionResponseDto } from '../dto/devoluciones.dto.js';

function nombreCompleto(usuario?: { nombre: string; apellido: string } | null): string {
  return usuario ? `${usuario.nombre} ${usuario.apellido}`.trim() : '';
}

function toDetalleResponseDto(detalle: DetalleNotaDevolucion): DetalleDevolucionResponseDto {
  return {
    id: detalle.id,
    idVarianteProducto: detalle.idVarianteProducto,
    sku: detalle.variante?.sku ?? null,
    productoNombre: detalle.variante?.producto?.nombre ?? null,
    descripcion: detalle.descripcion,
    idAlmacen: detalle.idAlmacen,
    almacenNombre: detalle.almacen?.nombre ?? null,
    precioUnitario: Number(detalle.precioUnitario),
    cantidad: detalle.cantidad,
    montoSubtotal: Number(detalle.montoSubtotal),
    estadoProducto: detalle.estadoProducto,
  };
}

export function toDevolucionResponseDto(devolucion: NotaDevolucion): DevolucionResponseDto {
  return {
    id: devolucion.id,
    codigoDevolucion: devolucion.codigoDevolucion,
    tipoDevolucion: devolucion.tipoDevolucion,
    motivoDevolucion: devolucion.motivoDevolucion,
    idCliente: devolucion.idCliente,
    clienteNombre: nombreCompleto(devolucion.cliente?.usuario),
    idSucursal: devolucion.idSucursal,
    sucursalNombre: devolucion.sucursal?.nombre ?? '',
    idCajero: devolucion.idCajero,
    cajeroNombre: nombreCompleto(devolucion.cajero?.usuario),
    idNotaVenta: devolucion.idNotaVenta,
    codigoNota: devolucion.notaVenta?.codigoNota ?? null,
    idReserva: devolucion.idReserva,
    codigoReserva: devolucion.reserva?.codigoReserva ?? null,
    idMovimientoCaja: devolucion.idMovimientoCaja,
    montoTotalReembolsado: Number(devolucion.montoTotalReembolsado),
    observaciones: devolucion.observaciones,
    fechaEmision: devolucion.fechaEmision,
    detalles: (devolucion.detalles ?? []).map(toDetalleResponseDto).sort((a, b) => a.id - b.id),
  };
}

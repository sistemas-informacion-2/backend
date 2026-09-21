import type { NotaVenta } from '../../comercial/entities/nota-venta.entity.js';
import type { Reserva } from '../entities/reserva.entity.js';
import type { DetalleReserva } from '../entities/detalle-reserva.entity.js';
import type { DetalleReservaResponseDto, PagoReservaResponseDto, ReservaResponseDto } from '../dto/reservas.dto.js';

function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function toDetalleResponseDto(detalle: DetalleReserva): DetalleReservaResponseDto {
  const variante = detalle.variante;
  return {
    id: detalle.id,
    idVarianteProducto: detalle.idVarianteProducto,
    idProducto: variante?.idProducto ?? 0,
    productoNombre: variante?.producto?.nombre ?? '',
    sku: variante?.sku ?? '',
    talla: variante?.talla ?? '',
    color: variante?.color ?? '',
    corte: variante?.corte ?? '',
    precioUnitario: Number(detalle.precioUnitario),
    cantidad: detalle.cantidad,
    subtotal: Number(detalle.subtotal),
  };
}

/** Suma de los anticipos ya cobrados; requiere `pagos` cargados. */
export function anticipoCobrado(reserva: Reserva): number {
  return redondear(
    (reserva.pagos ?? []).filter((pago) => pago.concepto === 'ANTICIPO_RESERVA').reduce((suma, pago) => suma + Number(pago.monto), 0),
  );
}

export function toReservaResponseDto(
  reserva: Reserva,
  opciones: { notaVenta?: NotaVenta | null; incluirDetalles?: boolean } = {},
): ReservaResponseDto {
  const usuario = reserva.cliente?.usuario;
  const anticipoPagado = anticipoCobrado(reserva);
  const activa = reserva.estado === 'PENDIENTE' || reserva.estado === 'PAGADA';

  const pagos: PagoReservaResponseDto[] = (reserva.pagos ?? []).map((pago) => ({
    id: pago.id,
    concepto: pago.concepto,
    monto: Number(pago.monto),
    pasarelaMetodo: pago.pasarela?.metodo ?? null,
    fechaPago: pago.fechaPago,
    horaPago: pago.horaPago,
  }));

  return {
    id: reserva.id,
    codigoReserva: reserva.codigoReserva,
    idCliente: reserva.idCliente,
    clienteNombre: usuario ? `${usuario.nombre} ${usuario.apellido}`.trim() : '',
    idSucursal: reserva.idSucursal,
    sucursalNombre: reserva.sucursal?.nombre ?? '',
    fechaReserva: reserva.fechaReserva,
    fechaLimite: reserva.fechaLimite,
    estado: reserva.estado,
    montoAnticipo: Number(reserva.montoAnticipo),
    montoTotal: Number(reserva.montoTotal),
    anticipoPagado,
    saldoPendiente: activa ? Math.max(0, redondear(Number(reserva.montoTotal) - anticipoPagado)) : 0,
    observaciones: reserva.observaciones,
    idNotaVenta: opciones.notaVenta?.id ?? null,
    codigoNotaVenta: opciones.notaVenta?.codigoNota ?? null,
    detalles: opciones.incluirDetalles === false ? [] : (reserva.detalles ?? []).map(toDetalleResponseDto).sort((a, b) => a.id - b.id),
    pagos,
  };
}

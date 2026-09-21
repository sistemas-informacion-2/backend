import type { NotaVenta } from '../entities/nota-venta.entity.js';
import type { DetalleNotaVenta } from '../entities/detalle-nota-venta.entity.js';
import type { Pago } from '../entities/pago.entity.js';
import type {
  DetalleVentaResponseDto,
  PagoResponseDto,
  VentaResponseDto,
} from '../dto/venta-response.dto.js';

export function toDetalleVentaResponseDto(detalle: DetalleNotaVenta): DetalleVentaResponseDto {
  return {
    id: detalle.id,
    idVarianteProducto: detalle.idVarianteProducto,
    sku: detalle.variante?.sku ?? null,
    productoNombre: detalle.variante?.producto?.nombre ?? detalle.descripcion,
    descripcion: detalle.descripcion,
    precioUnitario: Number(detalle.precioUnitario),
    cantidad: detalle.cantidad,
    subtotal: Number(detalle.subtotal),
  };
}

export function toPagoResponseDto(pago: Pago): PagoResponseDto {
  return {
    id: pago.id,
    idPasarela: pago.idPasarela,
    pasarelaMetodo: pago.pasarela?.metodo ?? null,
    monto: Number(pago.monto),
    concepto: pago.concepto,
    fechaPago: pago.fechaPago,
    horaPago: pago.horaPago,
  };
}

export function toVentaResponseDto(venta: NotaVenta): VentaResponseDto {
  return {
    id: venta.id,
    codigoNota: venta.codigoNota,
    idCliente: venta.idCliente,
    clienteNombre: nombreCliente(venta),
    idCajero: venta.idCajero,
    cajeroNombre: nombreCajero(venta),
    idSucursal: venta.idSucursal,
    sucursalNombre: venta.sucursal?.nombre ?? '',
    idPasarela: venta.idPasarela,
    idMovimientoCaja: venta.idMovimientoCaja,
    tipoVenta: venta.tipoVenta,
    nroFactura: venta.nroFactura,
    nitRazonSocial: venta.nitRazonSocial,
    fechaEmision: venta.fechaEmision,
    horaEmision: venta.horaEmision,
    subtotal: Number(venta.subtotal),
    descuento: Number(venta.descuento),
    impuesto: Number(venta.impuesto),
    montoTotal: Number(venta.montoTotal),
    estadoPago: venta.estadoPago,
    detalles: (venta.detalles ?? []).map(toDetalleVentaResponseDto),
    pagos: (venta.pagos ?? []).map(toPagoResponseDto),
  };
}

function nombreCliente(venta: NotaVenta): string {
  const usuario = venta.cliente?.usuario;
  if (!usuario) return '';
  return `${usuario.nombre} ${usuario.apellido}`.trim();
}

function nombreCajero(venta: NotaVenta): string | null {
  const usuario = venta.cajero?.usuario;
  if (!usuario) return null;
  return `${usuario.nombre} ${usuario.apellido}`.trim() || null;
}

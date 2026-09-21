import type { ConceptoPago } from '../entities/pago.entity.js';
import type { TipoNotaVenta } from '../entities/nota-venta.entity.js';

export class DetalleVentaResponseDto {
  id: number;
  idVarianteProducto: number | null;
  sku: string | null;
  productoNombre: string;
  descripcion: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
}

export class PagoResponseDto {
  id: number;
  idPasarela: number | null;
  pasarelaMetodo: string | null;
  monto: number;
  concepto: ConceptoPago;
  fechaPago: string;
  horaPago: string;
}

export class VentaResponseDto {
  id: number;
  codigoNota: string;
  idCliente: number;
  clienteNombre: string;
  idCajero: number | null;
  cajeroNombre: string | null;
  idSucursal: number;
  sucursalNombre: string;
  idPasarela: number | null;
  idMovimientoCaja: number | null;
  tipoVenta: TipoNotaVenta;
  nroFactura: string | null;
  nitRazonSocial: string | null;
  fechaEmision: string;
  horaEmision: string;
  subtotal: number;
  descuento: number;
  impuesto: number;
  montoTotal: number;
  estadoPago: string;
  detalles: DetalleVentaResponseDto[];
  pagos: PagoResponseDto[];
}

export class VentaPaginatedResponseDto {
  items: VentaResponseDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

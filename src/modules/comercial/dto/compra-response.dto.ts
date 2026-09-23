import type { EstadoCompra } from '../entities/nota-compra.entity.js';

export class DetalleCompraResponseDto {
  id: number;
  idVarianteProducto: number;
  sku: string;
  productoNombre: string;
  talla: string;
  color: string;
  idAlmacen: number;
  almacenNombre: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
  nroLote: string | null;
}

export class CompraResponseDto {
  id: number;
  idProveedor: number;
  proveedorNombre: string;
  idSucursal: number;
  sucursalNombre: string;
  idMovimientoCaja: number | null;
  nroFactura: string | null;
  fechaEmision: Date;
  fechaEntregaProgramada: string | null;
  fechaPago: string | null;
  subtotal: number;
  total: number;
  estado: EstadoCompra;
  cantidadLineas: number;
  /** Vacio en los listados; solo el detalle de una compra trae sus lineas. */
  detalles: DetalleCompraResponseDto[];
}

export class ComprasPaginatedResponseDto {
  items: CompraResponseDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

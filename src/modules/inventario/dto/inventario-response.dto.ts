/** Una linea del kardex de una fila de stock. */
export interface MovimientoInventarioResponseDto {
  id: number;
  tipo: string;
  cantidad: number;
  deltaReservado: number;
  stockResultante: number;
  reservadoResultante: number;
  costoUnitario: number | null;
  referenciaTipo: string | null;
  referenciaId: number | null;
  /** Codigo legible del documento que produjo el movimiento (NV-000123, NC-45, TR-7...); null en ajustes y saldo inicial. */
  referenciaCodigo: string | null;
  idUsuario: number | null;
  /** Nombre de quien lo hizo; null si fue el sistema (p. ej. el vencimiento automatico de una reserva). */
  usuarioNombre: string | null;
  motivo: string | null;
  fechaHora: Date;
}

export class InventarioResponseDto {
  id: number;
  idAlmacen: number;
  almacenNombre: string;
  idSucursal: number;
  sucursalNombre: string;
  idVarianteProducto: number;
  sku: string;
  productoNombre: string;
  talla: string;
  color: string;
  /** Precio de lista del producto. */
  precio: number;
  /** Precio que se cobra hoy (con el descuento del producto): el mismo en caja, en linea y en reservas. */
  precioVenta: number;
  stockDisponible: number;
  stockReservado: number;
  stockMinimo: number;
  stockMaximo: number;
  bajoMinimo: boolean;
}

export class InventarioPaginatedResponseDto {
  items: InventarioResponseDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

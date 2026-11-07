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
  idUsuario: number | null;
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

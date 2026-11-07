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

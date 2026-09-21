import type { Inventario } from '../entities/inventario.entity.js';
import type { InventarioResponseDto } from '../dto/inventario-response.dto.js';

export function toInventarioResponseDto(inventario: Inventario): InventarioResponseDto {
  const almacen = inventario.almacen;
  const variante = inventario.variante;

  return {
    id: inventario.id,
    idAlmacen: inventario.idAlmacen,
    almacenNombre: almacen?.nombre ?? '',
    idSucursal: almacen?.idSucursal ?? 0,
    sucursalNombre: almacen?.sucursal?.nombre ?? '',
    idVarianteProducto: inventario.idVarianteProducto,
    sku: variante?.sku ?? '',
    productoNombre: variante?.producto?.nombre ?? '',
    talla: variante?.talla ?? '',
    color: variante?.color ?? '',
    stockDisponible: inventario.stockDisponible,
    stockReservado: inventario.stockReservado,
    stockMinimo: inventario.stockMinimo,
    stockMaximo: inventario.stockMaximo,
    bajoMinimo: inventario.stockDisponible <= inventario.stockMinimo,
  };
}

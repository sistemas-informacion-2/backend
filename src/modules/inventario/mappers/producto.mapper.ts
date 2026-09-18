import type { Producto } from '../entities/producto.entity.js';
import type { ProductoResponseDto } from '../dto/producto-response.dto.js';

export function toProductoResponseDto(producto: Producto): ProductoResponseDto {
  return {
    id: producto.id,
    nombre: producto.nombre,
    descripcion: producto.descripcion,
    precio: producto.precio,
    activo: producto.activo,
    categoriaId: producto.idCategoria,
    categoriaNombre: producto.categoria?.nombre ?? '',
    sucursalId: producto.idSucursal,
    sucursalNombre: producto.sucursal?.nombre ?? null,
    imagenes: (producto.imagenes ?? [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((imagen) => ({ id: imagen.id, url: imagen.url, esPrincipal: imagen.esPrincipal, orden: imagen.orden })),
    variantes: (producto.variantes ?? []).map((variante) => ({
      id: variante.id,
      sku: variante.sku,
      talla: variante.talla,
      color: variante.color,
      corte: variante.corte,
      codigoHexColor: variante.codigoHexColor,
      modelo3dUrl: variante.modelo3dUrl,
      activo: variante.activo,
    })),
  };
}

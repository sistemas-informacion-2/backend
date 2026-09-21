import type { Producto } from '../entities/producto.entity.js';
import type { ProductoResponseDto } from '../dto/producto-response.dto.js';

export function toProductoResponseDto(producto: Producto): ProductoResponseDto {
  return {
    id: producto.id,
    nombre: producto.nombre,
    descripcion: producto.descripcion,
    precio: producto.precio,
    descuentoPorcentaje: producto.descuentoPorcentaje,
    activo: producto.activo,
    categoriaId: producto.idCategoria,
    categoriaNombre: producto.categoria?.nombre ?? '',
    sucursales: (producto.productoSucursales ?? [])
      .filter((relacion) => !!relacion.sucursal)
      .map((relacion) => ({ id: relacion.idSucursal, nombre: relacion.sucursal.nombre, activo: relacion.activo })),
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
      modelo3dUrl: variante.modelo3dUrl,
      activo: variante.activo,
    })),
  };
}

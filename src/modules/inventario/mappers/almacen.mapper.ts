import type { Almacen } from '../entities/almacen.entity.js';
import type { AlmacenResponseDto } from '../dto/almacen-response.dto.js';

export function toAlmacenResponseDto(almacen: Almacen): AlmacenResponseDto {
  return {
    id: almacen.id,
    idSucursal: almacen.idSucursal,
    sucursalNombre: almacen.sucursal?.nombre ?? '',
    nombre: almacen.nombre,
    ubicacionFisica: almacen.ubicacionFisica,
    activo: almacen.activo,
    cantidadVariantes: (almacen.inventarios ?? []).length,
  };
}

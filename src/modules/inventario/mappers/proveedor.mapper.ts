import type { Proveedor } from '../entities/proveedor.entity.js';
import type { ProveedorResponseDto } from '../dto/proveedor-response.dto.js';

export function toProveedorResponseDto(proveedor: Proveedor): ProveedorResponseDto {
  return {
    id: proveedor.id,
    empresa: proveedor.empresa,
    nit: proveedor.nit,
    nombreContacto: proveedor.nombreContacto,
    telefonoContacto: proveedor.telefonoContacto,
    correoContacto: proveedor.correoContacto,
    activo: proveedor.activo,
  };
}

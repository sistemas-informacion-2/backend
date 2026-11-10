import type { Empresa } from '../entities/empresa.entity.js';
import type { EmpresaPublicaResponseDto, EmpresaResponseDto } from '../dto/empresa.dto.js';

export function toEmpresaResponse(empresa: Empresa): EmpresaResponseDto {
  return {
    id: empresa.id,
    slug: empresa.slug,
    nombre: empresa.nombre,
    razonSocial: empresa.razonSocial,
    nit: empresa.nit,
    logoUrl: empresa.logoUrl,
    colorPrimario: empresa.colorPrimario,
    estado: empresa.estado,
    fechaCreacion: empresa.fechaCreacion,
  };
}

export function toEmpresaPublica(empresa: Empresa): EmpresaPublicaResponseDto {
  return {
    slug: empresa.slug,
    nombre: empresa.nombre,
    logoUrl: empresa.logoUrl,
    colorPrimario: empresa.colorPrimario,
    estado: empresa.estado,
  };
}

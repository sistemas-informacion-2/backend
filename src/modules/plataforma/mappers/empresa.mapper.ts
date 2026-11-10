import { estadoVigencia } from '../../../common/tenant/plan-vigencia.js';
import type { Empresa } from '../entities/empresa.entity.js';
import type { EmpresaPublicaResponseDto, EmpresaResponseDto } from '../dto/empresa.dto.js';

/** `empresa.plan` tiene que venir cargado (relations: { plan: true }). */
export function toEmpresaResponse(empresa: Empresa): EmpresaResponseDto {
  return {
    id: empresa.id,
    slug: empresa.slug,
    nombre: empresa.nombre,
    razonSocial: empresa.razonSocial,
    nit: empresa.nit,
    pais: empresa.pais,
    ciudad: empresa.ciudad,
    direccion: empresa.direccion,
    telefono: empresa.telefono,
    logoUrl: empresa.logoUrl,
    colorPrimario: empresa.colorPrimario,
    estado: empresa.estado,
    plan: { codigo: empresa.plan.codigo, nombre: empresa.plan.nombre },
    planVenceEl: empresa.planVenceEl,
    vigencia: estadoVigencia(empresa.planVenceEl),
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
    planVigente: estadoVigencia(empresa.planVenceEl) !== 'VENCIDO',
  };
}

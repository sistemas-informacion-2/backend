import type { Sucursal } from '../entities/sucursal.entity.js';
import type { Ciudad } from '../entities/ciudad.entity.js';
import type { Departamento } from '../entities/departamento.entity.js';
import type {
  CiudadResponseDto,
  DepartamentoResponseDto,
  SucursalResponseDto,
} from '../dto/sucursal-response.dto.js';

/** Postgres devuelve TIME como "HH:mm:ss"; lo recortamos a "HH:mm" para que calce con el patron que valida ActualizarSucursalDto al reenviar el mismo valor. */
function aHoraCorta(hora: string | null): string | null {
  return hora === null ? null : hora.slice(0, 5);
}

/** Requiere que `sucursal.ciudad.departamento` venga cargado (ver SucursalRepository). */
export function toSucursalResponseDto(sucursal: Sucursal): SucursalResponseDto {
  return {
    id: sucursal.id,
    nombre: sucursal.nombre,
    ubicacion: sucursal.ubicacion,
    telefono: sucursal.telefono,
    correo: sucursal.correo,
    horarioApertura: aHoraCorta(sucursal.horarioApertura),
    horarioCierre: aHoraCorta(sucursal.horarioCierre),
    activo: sucursal.activo,
    ciudadId: sucursal.idCiudad,
    ciudadNombre: sucursal.ciudad.nombre,
    departamentoNombre: sucursal.ciudad.departamento.nombre,
  };
}

export function toCiudadResponseDto(ciudad: Ciudad): CiudadResponseDto {
  return {
    id: ciudad.id,
    nombre: ciudad.nombre,
    departamentoId: ciudad.idDepartamento,
    departamentoNombre: ciudad.departamento.nombre,
  };
}

export function toDepartamentoResponseDto(departamento: Departamento): DepartamentoResponseDto {
  return {
    id: departamento.id,
    nombre: departamento.nombre,
  };
}

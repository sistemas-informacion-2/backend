import type { Permiso } from '../entities/permiso.entity.js';
import type { Rol } from '../entities/rol.entity.js';
import type { PermisoAgrupadoResponseDto } from '../dto/permiso-response.dto.js';
import type { PermisoResponseDto, RolResponseDto } from '../dto/rol-response.dto.js';

export function toPermisoResponse(permiso: Permiso): PermisoResponseDto {
  return {
    id: permiso.id,
    accion: permiso.accion,
    descripcion: permiso.descripcion,
    modulo: permiso.accion.split(':')[0] ?? 'general',
    activo: permiso.activo,
  };
}

export function toPermisosAgrupados(permisos: Permiso[]): PermisoAgrupadoResponseDto[] {
  const grupos = new Map<string, PermisoAgrupadoResponseDto>();

  for (const permiso of permisos) {
    const modulo = permiso.accion.split(':')[0] ?? 'general';
    const grupo = grupos.get(modulo) ?? { modulo, permisos: [] };
    grupo.permisos.push({
      id: permiso.id,
      accion: permiso.accion,
      descripcion: permiso.descripcion,
      activo: permiso.activo,
    });
    grupos.set(modulo, grupo);
  }

  return Array.from(grupos.values()).sort((a, b) => a.modulo.localeCompare(b.modulo));
}

export function toRolResponse(rol: Rol): RolResponseDto {
  return {
    id: rol.id,
    nombre: rol.nombre,
    descripcion: rol.descripcion,
    activo: rol.activo,
    fechaCreacion: rol.fechaCreacion,
    cantidadUsuarios: (rol.rolesUsuario ?? []).filter((relacion) => relacion.activo && relacion.usuario?.activo).length,
    permisos: (rol.rolesPermiso ?? [])
      .filter((relacion) => relacion.activo && relacion.permiso?.activo)
      .map((relacion) => toPermisoResponse(relacion.permiso)),
  };
}

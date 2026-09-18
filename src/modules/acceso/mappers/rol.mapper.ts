import type { Permiso } from '../entities/permiso.entity.js';
import type { Rol } from '../entities/rol.entity.js';
import type { PermisoGrupoResponseDto, PermisoResponseDto, RolResponseDto } from '../dto/rol-response.dto.js';

export function toPermisoResponse(permiso: Permiso): PermisoResponseDto {
  return {
    id: permiso.id,
    accion: permiso.accion,
    descripcion: permiso.descripcion,
    modulo: permiso.accion.split(':')[0] ?? permiso.accion,
    activo: permiso.activo,
  };
}

export function toRolResponse(rol: Rol, cantidadUsuarios: number): RolResponseDto {
  return {
    id: rol.id,
    nombre: rol.nombre,
    descripcion: rol.descripcion,
    activo: rol.activo,
    fechaCreacion: rol.fechaCreacion,
    cantidadUsuarios,
    permisos: (rol.rolesPermiso ?? [])
      .filter((rolPermiso) => rolPermiso.activo && rolPermiso.permiso?.activo)
      .map((rolPermiso) => toPermisoResponse(rolPermiso.permiso)),
  };
}

/** Agrupa permisos por su módulo (primer segmento del código de acción, p.ej. "acceso:roles:gestionar" -> "acceso"). */
export function agruparPermisos(permisos: Permiso[]): PermisoGrupoResponseDto[] {
  const grupos = new Map<string, PermisoResponseDto[]>();
  for (const permiso of permisos) {
    const respuesta = toPermisoResponse(permiso);
    const lista = grupos.get(respuesta.modulo) ?? [];
    lista.push(respuesta);
    grupos.set(respuesta.modulo, lista);
  }
  return Array.from(grupos.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([modulo, permisosGrupo]) => ({ modulo, permisos: permisosGrupo }));
}

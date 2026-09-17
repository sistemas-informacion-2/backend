import type { Usuario } from '../entities/usuario.entity.js';
import type { PerfilDto } from '../dto/auth-response.dto.js';
import type { UsuarioResponseDto } from '../dto/usuario-response.dto.js';

/** Aplana la matriz rol -> rol_permiso -> permiso en una lista plana de códigos de acción, sin duplicados. */
export function extraerPermisos(usuario: Usuario): string[] {
  const permisos = new Set<string>();
  for (const rolUsuario of usuario.rolesUsuario ?? []) {
    if (!rolUsuario.activo || !rolUsuario.rol?.activo) continue;
    for (const rolPermiso of rolUsuario.rol.rolesPermiso ?? []) {
      if (rolPermiso.activo && rolPermiso.permiso?.activo) {
        permisos.add(rolPermiso.permiso.accion);
      }
    }
  }
  return Array.from(permisos);
}

/** Campos propios de USUARIO -> PerfilDto. La enriquecen con sucursal/cliente en el service, que sí necesita más queries. */
export function toPerfilBase(usuario: Usuario, permisos: string[]): PerfilDto {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    telefono: usuario.telefono,
    tipoUsuario: usuario.tipoUsuario,
    permisos,
  };
}

export function toUsuarioResponse(usuario: Usuario): UsuarioResponseDto {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    telefono: usuario.telefono,
    sexo: usuario.sexo,
    tipoUsuario: usuario.tipoUsuario,
    estadoAcceso: usuario.estadoAcceso,
    fechaCreacion: usuario.fechaCreacion,
    activo: usuario.activo,
    roles: (usuario.rolesUsuario ?? [])
      .filter((relacion) => relacion.activo && relacion.rol?.activo)
      .map((relacion) => ({
        id: relacion.rol.id,
        nombre: relacion.rol.nombre,
      })),
  };
}

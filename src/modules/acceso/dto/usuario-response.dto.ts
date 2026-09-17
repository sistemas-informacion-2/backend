import type { EstadoAcceso, TipoUsuario } from '../entities/usuario.entity.js';

export class RolResumenDto {
  id: number;
  nombre: string;
}

export class UsuarioResponseDto {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  sexo: string | null;
  tipoUsuario: TipoUsuario;
  estadoAcceso: EstadoAcceso;
  fechaCreacion: Date;
  activo: boolean;
  roles: RolResumenDto[];
}

export class UsuariosPaginatedResponseDto {
  items: UsuarioResponseDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

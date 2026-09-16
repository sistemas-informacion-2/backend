import type { TipoUsuario } from '../entities/usuario.entity.js';

export class PerfilDto {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  tipoUsuario: TipoUsuario;
  permisos: string[];
  sucursalId?: number;
  sucursalNombre?: string;
  puntosFidelidad?: number;
}

export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  perfil: PerfilDto;
}

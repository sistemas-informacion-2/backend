import type { TipoUsuario } from '../entities/usuario.entity.js';

export interface JwtPayload {
  sub: number;
  tipoUsuario: TipoUsuario;
  permisos: string[];
  sucursalId?: number;
  jti: string;
}

export interface ActiveUser extends JwtPayload {}

import type { TipoUsuario } from '../entities/usuario.entity.js';

export interface JwtPayload {
  sub: number;
  tipoUsuario: TipoUsuario;
  permisos: string[];
  sucursalId?: number;
  /** Empresa del usuario; null para el superadmin de la plataforma. Ausente en tokens emitidos antes del SaaS. */
  empresaId?: number | null;
  jti: string;
}

export interface ActiveUser extends JwtPayload {}

export interface PermisoResponseDto {
  id: number;
  accion: string;
  descripcion: string | null;
  modulo: string;
  activo: boolean;
}

export interface PermisoGrupoResponseDto {
  modulo: string;
  permisos: PermisoResponseDto[];
}

export interface RolResponseDto {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  fechaCreacion: Date;
  cantidadUsuarios: number;
  permisos: PermisoResponseDto[];
}

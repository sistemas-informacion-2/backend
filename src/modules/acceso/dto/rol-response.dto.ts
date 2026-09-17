export class PermisoResponseDto {
  id: number;
  accion: string;
  descripcion: string | null;
  modulo: string;
  activo: boolean;
}

export class RolResponseDto {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  fechaCreacion: Date;
  cantidadUsuarios: number;
  permisos: PermisoResponseDto[];
}

export class PermisoAgrupadoResponseDto {
  modulo: string;
  permisos: Array<{
    id: number;
    accion: string;
    descripcion: string | null;
    activo: boolean;
  }>;
}

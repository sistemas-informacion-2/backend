export class AlmacenResponseDto {
  id: number;
  idSucursal: number;
  sucursalNombre: string;
  nombre: string;
  ubicacionFisica: string | null;
  activo: boolean;
  cantidadVariantes: number;
}

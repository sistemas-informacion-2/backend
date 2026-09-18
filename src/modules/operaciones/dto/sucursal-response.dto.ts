export class SucursalResponseDto {
  id: number;
  nombre: string;
  ubicacion: string;
  telefono: string | null;
  correo: string | null;
  horarioApertura: string | null;
  horarioCierre: string | null;
  activo: boolean;
  ciudadId: number;
  ciudadNombre: string;
  departamentoNombre: string;
}

export class CiudadResponseDto {
  id: number;
  nombre: string;
  departamentoId: number;
  departamentoNombre: string;
}

export class DepartamentoResponseDto {
  id: number;
  nombre: string;
}

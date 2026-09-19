import type { EstadoAcceso } from '../../acceso/entities/usuario.entity.js';

export class EmpleadoResponseDto {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  sexo: string | null;
  estadoAcceso: EstadoAcceso;
  activo: boolean;
  codigoEmpleado: string;
  salario: number;
  fechaContratacion: string;
  fechaFinalizacion: string | null;
}

export class EmpleadosPaginatedResponseDto {
  items: EmpleadoResponseDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

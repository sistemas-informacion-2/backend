import type { EstadoAcceso } from '../../acceso/entities/usuario.entity.js';

export class ClienteResponseDto {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  sexo: string | null;
  estadoAcceso: EstadoAcceso;
  activo: boolean;
  ciudadResidencia: string | null;
  direccionPrincipal: string | null;
  puntosFidelidad: number;
}

export class ClientesPaginatedResponseDto {
  items: ClienteResponseDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

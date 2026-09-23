export class BitacoraUsuarioDto {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
}

export class BitacoraResponseDto {
  id: string;
  usuarioId: number | null;
  usuario: BitacoraUsuarioDto | null;
  accion: string;
  operacion: string;
  tablaAfectada: string;
  ipOrigen: string | null;
  userAgent: string | null;
  datosAnteriores: Record<string, unknown> | null;
  datosNuevos: Record<string, unknown> | null;
  fechaHora: Date;
}

export class BitacoraPaginatedResponseDto {
  items: BitacoraResponseDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
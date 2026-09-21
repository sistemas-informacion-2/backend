export class NotificacionResponseDto {
  id: number;
  idUsuario: number;
  destinatario: string;
  titulo: string;
  mensaje: string;
  leido: boolean;
  fechaEnvio: Date;
}

export class NotificacionesPaginatedResponseDto {
  items: NotificacionResponseDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class EnvioNotificacionResponseDto {
  cantidadEnviada: number;
}

export class DestinatarioResponseDto {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  etiqueta: string;
}

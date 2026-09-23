import type { NotificacionPush } from '../entities/notificacion-push.entity.js';
import type { NotificacionResponseDto } from '../dto/notificacion-response.dto.js';

export function toNotificacionResponseDto(notificacion: NotificacionPush): NotificacionResponseDto {
  const usuario = notificacion.usuario;
  return {
    id: notificacion.id,
    idUsuario: notificacion.idUsuario,
    destinatario: usuario ? `${usuario.nombre} ${usuario.apellido}`.trim() : '',
    titulo: notificacion.titulo,
    mensaje: notificacion.mensaje,
    leido: notificacion.leido,
    fechaEnvio: notificacion.fechaEnvio,
  };
}

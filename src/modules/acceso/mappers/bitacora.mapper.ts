import type { Bitacora } from '../entities/bitacora.entity.js';
import type { BitacoraResponseDto } from '../dto/bitacora-response.dto.js';

export function toBitacoraResponse(log: Bitacora): BitacoraResponseDto {
  const operacion = log.accion.split(' ', 1)[0] ?? log.accion;
  return {
    id: log.id,
    usuarioId: log.idUsuario,
    usuario: log.usuario
      ? { id: log.usuario.id, nombre: log.usuario.nombre, apellido: log.usuario.apellido, email: log.usuario.email }
      : null,
    accion: log.accion,
    operacion,
    tablaAfectada: log.tablaAfectada,
    ipOrigen: log.ipOrigen,
    userAgent: log.userAgent,
    datosAnteriores: log.datosAnteriores,
    datosNuevos: log.datosNuevos,
    fechaHora: log.fechaHora,
  };
}
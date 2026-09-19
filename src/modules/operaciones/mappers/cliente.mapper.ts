import type { Cliente } from '../entities/cliente.entity.js';
import type { ClienteResponseDto } from '../dto/cliente-response.dto.js';

export function toClienteResponse(cliente: Cliente): ClienteResponseDto {
  const usuario = cliente.usuario;
  return {
    id: cliente.idUsuario,
    nombre: usuario?.nombre ?? '',
    apellido: usuario?.apellido ?? '',
    email: usuario?.email ?? '',
    telefono: usuario?.telefono ?? null,
    sexo: usuario?.sexo ?? null,
    estadoAcceso: usuario?.estadoAcceso ?? 'HABILITADO',
    activo: usuario?.activo ?? false,
    ciudadResidencia: cliente.ciudadResidencia,
    direccionPrincipal: cliente.direccionPrincipal,
    puntosFidelidad: cliente.puntosFidelidad,
  };
}

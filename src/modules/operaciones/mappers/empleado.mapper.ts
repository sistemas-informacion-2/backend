import type { Empleado } from '../entities/empleado.entity.js';
import type { EmpleadoResponseDto } from '../dto/empleado-response.dto.js';

export function toEmpleadoResponse(empleado: Empleado): EmpleadoResponseDto {
  const usuario = empleado.usuario;
  return {
    id: empleado.idUsuario,
    nombre: usuario?.nombre ?? '',
    apellido: usuario?.apellido ?? '',
    email: usuario?.email ?? '',
    telefono: usuario?.telefono ?? null,
    sexo: usuario?.sexo ?? null,
    estadoAcceso: usuario?.estadoAcceso ?? 'HABILITADO',
    activo: usuario?.activo ?? false,
    codigoEmpleado: empleado.codigoEmpleado,
    salario: Number(empleado.salario),
    fechaContratacion: empleado.fechaContratacion,
    fechaFinalizacion: empleado.fechaFinalizacion,
  };
}

import type { Temporada } from '../entities/temporada.entity.js';
import type { EstadoTemporada, TemporadaResponseDto } from '../dto/temporada-response.dto.js';

function calcularEstado(fechaInicio: string, fechaFin: string): EstadoTemporada {
  const hoy = new Date().toISOString().slice(0, 10);
  if (hoy < fechaInicio) return 'PROXIMA';
  if (hoy > fechaFin) return 'FINALIZADA';
  return 'VIGENTE';
}

export function toTemporadaResponseDto(temporada: Temporada): TemporadaResponseDto {
  return {
    id: temporada.id,
    nombre: temporada.nombre,
    fechaInicio: temporada.fechaInicio,
    fechaFin: temporada.fechaFin,
    descripcion: temporada.descripcion,
    estado: calcularEstado(temporada.fechaInicio, temporada.fechaFin),
  };
}

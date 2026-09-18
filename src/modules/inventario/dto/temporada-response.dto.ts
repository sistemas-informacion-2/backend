export type EstadoTemporada = 'PROXIMA' | 'VIGENTE' | 'FINALIZADA';

export class TemporadaResponseDto {
  id: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  descripcion: string | null;
  estado: EstadoTemporada;
}

import type { IntegracionPago } from '../entities/pasarela-pago.entity.js';

export type OrigenCredenciales = 'PANEL' | 'NINGUNA';

export class PasarelaResponseDto {
  id: number;
  codigo: string;
  metodo: string;
  descripcion: string | null;
  integracion: IntegracionPago;
  comisionPorcentaje: number;
  disponiblePresencial: boolean;
  disponibleLinea: boolean;
  tieneApiKey: boolean;
  origenCredenciales: OrigenCredenciales;
}

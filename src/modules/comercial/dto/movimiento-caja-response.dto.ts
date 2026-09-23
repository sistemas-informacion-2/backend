import type { TipoMovimientoCaja } from '../entities/movimiento-caja.entity.js';

export class MovimientoCajaResponseDto {
  id: number;
  idCaja: number;
  tipo: TipoMovimientoCaja;
  concepto: string;
  monto: number;
  observaciones: string | null;
  fechaHora: Date;
}

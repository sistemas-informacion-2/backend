import type { CategoriaMovimientoCaja, SubcategoriaGasto, TipoMovimientoCaja } from '../entities/movimiento-caja.entity.js';

export class MovimientoCajaResponseDto {
  id: number;
  idCaja: number;
  tipo: TipoMovimientoCaja;
  categoria: CategoriaMovimientoCaja;
  subcategoriaGasto: SubcategoriaGasto | null;
  concepto: string;
  monto: number;
  observaciones: string | null;
  fechaHora: Date;
}

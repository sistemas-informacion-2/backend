import type { EstadoCaja } from '../entities/caja.entity.js';
import type { MovimientoCajaResponseDto } from './movimiento-caja-response.dto.js';

export class CajaResponseDto {
  id: number;
  idSucursal: number;
  sucursalNombre: string;
  idCajero: number | null;
  cajeroNombre: string | null;
  fechaApertura: Date;
  fechaCierre: Date | null;
  horaApertura: string;
  horaCierre: string | null;
  montoInicial: number;
  montoFinal: number | null;
  estado: EstadoCaja;
  totalIngresos: number;
  totalEgresos: number;
  montoEsperado: number;
  movimientos: MovimientoCajaResponseDto[];
}

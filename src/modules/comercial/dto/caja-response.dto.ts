import type { EstadoCaja } from '../entities/caja.entity.js';
import type { MovimientoCajaResponseDto } from './movimiento-caja-response.dto.js';

/**
 * Pago recibido por internet (PayPal, QR, tarjeta) durante el turno de la caja. No pasa por el cajon: se muestra junto a
 * los movimientos para que la sucursal vea todo lo cobrado, pero no forma parte del monto esperado en efectivo.
 */
export class CobroEnLineaResponseDto {
  id: number;
  concepto: string;
  monto: number;
  metodo: string | null;
  fechaHora: Date;
}

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
  totalCobrosEnLinea: number;
  cobrosEnLinea: CobroEnLineaResponseDto[];
}

import type { Caja } from '../entities/caja.entity.js';
import type { MovimientoCaja } from '../entities/movimiento-caja.entity.js';
import type { CajaResponseDto } from '../dto/caja-response.dto.js';
import type { MovimientoCajaResponseDto } from '../dto/movimiento-caja-response.dto.js';

export function toMovimientoCajaResponseDto(movimiento: MovimientoCaja): MovimientoCajaResponseDto {
  return {
    id: movimiento.id,
    idCaja: movimiento.idCaja,
    tipo: movimiento.tipo,
    concepto: movimiento.concepto,
    monto: Number(movimiento.monto),
    observaciones: movimiento.observaciones,
    fechaHora: movimiento.fechaHora,
  };
}

export function toCajaResponseDto(caja: Caja): CajaResponseDto {
  const movimientos = (caja.movimientos ?? [])
    .map(toMovimientoCajaResponseDto)
    .sort((a, b) => a.id - b.id);

  const totalIngresos = movimientos
    .filter((movimiento) => movimiento.tipo === 'INGRESO')
    .reduce((total, movimiento) => total + movimiento.monto, 0);
  const totalEgresos = movimientos
    .filter((movimiento) => movimiento.tipo === 'EGRESO')
    .reduce((total, movimiento) => total + movimiento.monto, 0);
  const montoInicial = Number(caja.montoInicial);

  return {
    id: caja.id,
    idSucursal: caja.idSucursal,
    sucursalNombre: caja.sucursal?.nombre ?? '',
    idCajero: caja.idCajero,
    cajeroNombre: nombreCajero(caja),
    fechaApertura: caja.fechaApertura,
    fechaCierre: caja.fechaCierre,
    horaApertura: caja.horaApertura,
    horaCierre: caja.horaCierre,
    montoInicial,
    montoFinal: caja.montoFinal === null ? null : Number(caja.montoFinal),
    estado: caja.estado,
    totalIngresos: redondear(totalIngresos),
    totalEgresos: redondear(totalEgresos),
    montoEsperado: redondear(montoInicial + totalIngresos - totalEgresos),
    movimientos,
  };
}

function nombreCajero(caja: Caja): string | null {
  const usuario = caja.cajero?.usuario;
  if (!usuario) return null;
  const nombre = `${usuario.nombre} ${usuario.apellido}`.trim();
  return nombre || null;
}

function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

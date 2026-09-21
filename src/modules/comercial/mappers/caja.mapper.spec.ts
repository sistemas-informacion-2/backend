import { toCajaResponseDto } from './caja.mapper.js';
import type { Caja } from '../entities/caja.entity.js';
import type { Pago } from '../entities/pago.entity.js';

function cajaBase(): Caja {
  return {
    id: 1,
    idSucursal: 1,
    sucursal: { nombre: 'Central' },
    idCajero: 5,
    cajero: null,
    fechaApertura: new Date('2026-09-21T08:00:00'),
    fechaCierre: null,
    horaApertura: '08:00:00',
    horaCierre: null,
    montoInicial: '100.00',
    montoFinal: null,
    estado: 'Abierta',
    movimientos: [
      { id: 1, idCaja: 1, tipo: 'INGRESO', concepto: 'Venta presencial NV-1', monto: '50.00', observaciones: null, fechaHora: new Date() },
      { id: 2, idCaja: 1, tipo: 'EGRESO', concepto: 'Compra', monto: '20.00', observaciones: null, fechaHora: new Date() },
    ],
  } as unknown as Caja;
}

const pagoEnLinea = (overrides: Record<string, unknown>): Pago =>
  ({
    id: 1,
    monto: 33.6,
    concepto: 'ANTICIPO_RESERVA',
    fechaPago: '2026-09-21',
    horaPago: '10:30:00',
    reserva: { codigoReserva: 'RS-000008' },
    notaVenta: null,
    pasarela: { metodo: 'PayPal' },
    ...overrides,
  }) as unknown as Pago;

describe('toCajaResponseDto con cobros en linea', () => {
  it('lista los cobros en linea con concepto y metodo, sin sumarlos al efectivo esperado', () => {
    const dto = toCajaResponseDto(cajaBase(), [
      pagoEnLinea({ id: 2, concepto: 'PAGO_TOTAL', monto: 70, notaVenta: { codigoNota: 'NV-000009' }, reserva: null, horaPago: '11:00:00', pasarela: { metodo: 'QR' } }),
      pagoEnLinea({ id: 1 }),
    ]);

    expect(dto.cobrosEnLinea.map((c) => [c.concepto, c.monto, c.metodo])).toEqual([
      ['Anticipo reserva RS-000008', 33.6, 'PayPal'],
      ['Compra en línea NV-000009', 70, 'QR'],
    ]);
    expect(dto.totalCobrosEnLinea).toBe(103.6);
    // El efectivo del cajon solo cuenta sus propios movimientos: 100 + 50 - 20.
    expect(dto.montoEsperado).toBe(130);
    expect(dto.totalIngresos).toBe(50);
  });

  it('sin cobros en linea, las listas quedan vacias', () => {
    const dto = toCajaResponseDto(cajaBase());

    expect(dto.cobrosEnLinea).toEqual([]);
    expect(dto.totalCobrosEnLinea).toBe(0);
  });
});

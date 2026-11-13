import { CuotaGenerativoService } from './cuota-generativo.service.js';

const HORA = 60 * 60 * 1000;

function crearCuota(porDia: number) {
  const config = { get: () => ({ apiKey: 'x', model: 'm', generativosPorDia: porDia }) } as never;
  return new CuotaGenerativoService(config);
}

describe('CuotaGenerativoService', () => {
  it('deja usar la IA hasta el tope diario y después no', () => {
    const cuota = crearCuota(2);
    const t0 = Date.UTC(2026, 10, 13, 12);

    expect(cuota.consumir(1, t0)).toBe(true);
    expect(cuota.consumir(1, t0 + 1)).toBe(true);
    expect(cuota.consumir(1, t0 + 2)).toBe(false);
  });

  it('cada empresa tiene su propio cupo', () => {
    const cuota = crearCuota(1);
    const t0 = Date.UTC(2026, 10, 13, 12);

    expect(cuota.consumir(1, t0)).toBe(true);
    expect(cuota.consumir(1, t0)).toBe(false);
    expect(cuota.consumir(2, t0)).toBe(true);
  });

  it('el cupo se libera 24 horas después de cada uso (ventana móvil, como el BI)', () => {
    const cuota = crearCuota(1);
    const t0 = Date.UTC(2026, 10, 13, 12);

    expect(cuota.consumir(1, t0)).toBe(true);
    expect(cuota.consumir(1, t0 + 23 * HORA)).toBe(false);
    expect(cuota.consumir(1, t0 + 24 * HORA + 1)).toBe(true);
  });

  it('un intento rechazado no cuenta como uso', () => {
    const cuota = crearCuota(1);
    const t0 = Date.UTC(2026, 10, 13, 12);

    cuota.consumir(1, t0);
    cuota.consumir(1, t0 + HORA);
    cuota.consumir(1, t0 + 2 * HORA);
    // Solo el primero contó: a las 24 horas de ese, ya hay cupo.
    expect(cuota.consumir(1, t0 + 24 * HORA + 1)).toBe(true);
  });
});

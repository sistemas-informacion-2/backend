import { estadoVigencia, finDeGracia, inicioDeNuevoPeriodo } from './plan-vigencia.js';

const AHORA = new Date('2026-11-09T12:00:00');
const dias = (n: number) => new Date(AHORA.getTime() + n * 86_400_000);

describe('estadoVigencia', () => {
  it('distingue sin vencimiento, vigente, por vencer, en gracia y vencido', () => {
    expect(estadoVigencia(null, AHORA)).toBe('SIN_VENCIMIENTO');
    expect(estadoVigencia(dias(10), AHORA)).toBe('VIGENTE');
    expect(estadoVigencia(dias(2), AHORA)).toBe('POR_VENCER');
    expect(estadoVigencia(dias(-1), AHORA)).toBe('EN_GRACIA');
    expect(estadoVigencia(dias(-4), AHORA)).toBe('VENCIDO');
  });

  it('la gracia dura 3 dias desde el vencimiento', () => {
    expect(finDeGracia(dias(0))).toEqual(dias(3));
    expect(estadoVigencia(dias(-2.9), AHORA)).toBe('EN_GRACIA');
    expect(estadoVigencia(dias(-3), AHORA)).toBe('VENCIDO');
  });
});

describe('inicioDeNuevoPeriodo', () => {
  it('una renovacion antes de vencer se suma al final; si ya vencio, empieza ahora', () => {
    expect(inicioDeNuevoPeriodo(dias(5), AHORA)).toEqual(dias(5));
    expect(inicioDeNuevoPeriodo(dias(-2), AHORA)).toEqual(AHORA);
    expect(inicioDeNuevoPeriodo(null, AHORA)).toEqual(AHORA);
  });
});

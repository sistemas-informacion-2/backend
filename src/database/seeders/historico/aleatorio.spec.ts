import { Aleatorio } from './aleatorio.js';
import { factorTemporada } from './catalogo-demo.js';

describe('Aleatorio', () => {
  it('la misma semilla repite exactamente la misma secuencia', () => {
    const a = new Aleatorio(42);
    const b = new Aleatorio(42);
    const serieA = Array.from({ length: 20 }, () => a.siguiente());
    expect(Array.from({ length: 20 }, () => b.siguiente())).toEqual(serieA);
    expect(new Aleatorio(43).siguiente()).not.toBe(serieA[0]);
  });

  it('entero queda dentro del rango, incluidos los extremos', () => {
    const azar = new Aleatorio(7);
    const vistos = new Set(Array.from({ length: 500 }, () => azar.entero(1, 3)));
    expect([...vistos].sort()).toEqual([1, 2, 3]);
  });

  it('ponderado respeta los pesos', () => {
    const azar = new Aleatorio(1);
    const conteo = { a: 0, b: 0 };
    for (let i = 0; i < 4000; i++) conteo[azar.ponderado(['a', 'b'] as const, (x) => (x === 'a' ? 3 : 1))]++;
    expect(conteo.a / 4000).toBeGreaterThan(0.7);
    expect(conteo.a / 4000).toBeLessThan(0.8);
  });

  it('poisson tiene la media pedida', () => {
    const azar = new Aleatorio(9);
    const n = 5000;
    let suma = 0;
    for (let i = 0; i < n; i++) suma += azar.poisson(6);
    expect(suma / n).toBeGreaterThan(5.8);
    expect(suma / n).toBeLessThan(6.2);
  });
});

describe('factorTemporada (hemisferio sur)', () => {
  it('la ropa de invierno se vende en junio y casi nada en enero; la de verano al reves', () => {
    expect(factorTemporada('INVIERNO', 5)).toBeGreaterThan(2);
    expect(factorTemporada('INVIERNO', 0)).toBeLessThan(0.5);
    expect(factorTemporada('VERANO', 0)).toBeGreaterThan(1.5);
    expect(factorTemporada('VERANO', 6)).toBeLessThan(0.5);
    expect(factorTemporada('TODO', 6)).toBe(1);
  });
});

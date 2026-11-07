import { fechaDeColumna, fechaLocal, horaLocal, inicioDeMes, sumarDias, sumarMeses } from './fecha.util.js';

describe('fecha.util (zona America/La_Paz, UTC-4)', () => {
  it('una venta de las 21:00 en La Paz es de ese dia aunque en UTC ya sea el siguiente', () => {
    const nochePaceña = new Date('2026-11-07T01:30:00Z'); // 21:30 del 6 en La Paz

    expect(fechaLocal(nochePaceña)).toBe('2026-11-06');
    expect(horaLocal(nochePaceña)).toBe('21:30:00');
  });

  it('la medianoche se muestra como 00, no como 24', () => {
    expect(horaLocal(new Date('2026-11-07T04:00:00Z'))).toBe('00:00:00');
  });

  it('suma y resta dias cruzando meses y anios', () => {
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-11-06', -13)).toBe('2026-10-24');
  });

  it('resta un mes sin pasarse del ultimo dia del mes destino', () => {
    expect(sumarMeses('2026-03-31', -1)).toBe('2026-02-28');
    expect(sumarMeses('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('lee una columna date de Postgres con los componentes locales con que la arma el driver', () => {
    expect(fechaDeColumna(new Date(2026, 8, 1))).toBe('2026-09-01');
  });

  it('primer dia del mes', () => {
    expect(inicioDeMes('2026-11-06')).toBe('2026-11-01');
  });
});

import { domingoDePascua, feriadosDeBolivia, generarCalendario, temporadaDe } from './calendario.js';

describe('calendario del DW', () => {
  it('calcula la Pascua de anios conocidos', () => {
    expect(domingoDePascua(2024)).toEqual({ mes: 2, dia: 31 });
    expect(domingoDePascua(2025)).toEqual({ mes: 3, dia: 20 });
    expect(domingoDePascua(2026)).toEqual({ mes: 3, dia: 5 });
  });

  it('feriados moviles de Bolivia en 2026: Carnaval 16-17/2, Viernes Santo 3/4, Corpus Christi 4/6', () => {
    const feriados = feriadosDeBolivia(2026);
    expect(feriados.get('2026-02-16')).toBe('Carnaval (lunes)');
    expect(feriados.get('2026-02-17')).toBe('Carnaval (martes)');
    expect(feriados.get('2026-04-03')).toBe('Viernes Santo');
    expect(feriados.get('2026-06-04')).toBe('Corpus Christi');
    expect(feriados.get('2026-08-06')).toBe('Dia de la Independencia');
    expect(feriados.size).toBe(11);
  });

  it('temporadas del hemisferio sur', () => {
    expect(temporadaDe(1, 15)).toBe('VERANO');
    expect(temporadaDe(3, 21)).toBe('OTONO');
    expect(temporadaDe(7, 1)).toBe('INVIERNO');
    expect(temporadaDe(9, 23)).toBe('PRIMAVERA');
    expect(temporadaDe(12, 21)).toBe('VERANO');
  });

  it('genera un dia por fecha con clave AAAAMMDD, dia ISO y semana ISO', () => {
    const dias = generarCalendario('2025-12-29', '2026-01-04');
    expect(dias).toHaveLength(7);
    expect(dias[0]).toMatchObject({ fechaKey: 20251229, diaSemana: 1, nombreDia: 'Lunes', semanaIso: 1, anioIso: 2026, esFinDeSemana: false });
    expect(dias[3]).toMatchObject({ fecha: '2026-01-01', feriado: 'Anio Nuevo', trimestre: 1, temporada: 'VERANO' });
    expect(dias[6]).toMatchObject({ diaSemana: 7, nombreDia: 'Domingo', esFinDeSemana: true });
  });

  it('cubre 2020-2032 sin huecos', () => {
    const dias = generarCalendario('2020-01-01', '2032-12-31');
    expect(dias).toHaveLength(4749);
    expect(new Set(dias.map((d) => d.fechaKey)).size).toBe(dias.length);
  });
});

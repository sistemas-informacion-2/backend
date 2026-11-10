/**
 * Filas de dw.dim_fecha: una por dia, con los atributos por los que el BI corta las ventas (dia de la semana,
 * temporada del hemisferio sur, feriados nacionales de Bolivia). Funcion pura: la usa la migracion que crea el DW.
 */

export interface DiaCalendario {
  fechaKey: number;
  fecha: string;
  anio: number;
  trimestre: number;
  mes: number;
  nombreMes: string;
  semanaIso: number;
  anioIso: number;
  dia: number;
  /** ISO: 1 = lunes ... 7 = domingo. */
  diaSemana: number;
  nombreDia: string;
  esFinDeSemana: boolean;
  feriado: string | null;
  temporada: 'VERANO' | 'OTONO' | 'INVIERNO' | 'PRIMAVERA';
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

/** Domingo de Pascua (algoritmo anonimo gregoriano). Mes 0-11. */
export function domingoDePascua(anio: number): { mes: number; dia: number } {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return { mes, dia };
}

/** Feriados nacionales de Bolivia de un anio, por 'AAAA-MM-DD'. */
export function feriadosDeBolivia(anio: number): Map<string, string> {
  const feriados = new Map<string, string>();
  const fijo = (mes: number, dia: number, nombre: string) => feriados.set(clave(new Date(Date.UTC(anio, mes - 1, dia))), nombre);
  fijo(1, 1, 'Anio Nuevo');
  fijo(1, 22, 'Dia del Estado Plurinacional');
  fijo(5, 1, 'Dia del Trabajo');
  fijo(6, 21, 'Anio Nuevo Andino Amazonico');
  fijo(8, 6, 'Dia de la Independencia');
  fijo(11, 2, 'Todos Santos');
  fijo(12, 25, 'Navidad');

  const pascua = domingoDePascua(anio);
  const relativo = (dias: number, nombre: string) => feriados.set(clave(new Date(Date.UTC(anio, pascua.mes, pascua.dia + dias))), nombre);
  relativo(-48, 'Carnaval (lunes)');
  relativo(-47, 'Carnaval (martes)');
  relativo(-2, 'Viernes Santo');
  relativo(60, 'Corpus Christi');
  return feriados;
}

/** Temporada del hemisferio sur, con las mismas fronteras que TemporadaSeederService. */
export function temporadaDe(mes: number, dia: number): DiaCalendario['temporada'] {
  const md = mes * 100 + dia;
  if (md >= 1221 || md <= 320) return 'VERANO';
  if (md <= 620) return 'OTONO';
  if (md <= 922) return 'INVIERNO';
  return 'PRIMAVERA';
}

/** Dias desde `desde` hasta `hasta` (incluidos), 'AAAA-MM-DD'. Trabaja en UTC: no depende de la zona del proceso. */
export function generarCalendario(desde: string, hasta: string): DiaCalendario[] {
  const dias: DiaCalendario[] = [];
  const feriadosPorAnio = new Map<number, Map<string, string>>();
  for (let t = Date.parse(`${desde}T00:00:00Z`); t <= Date.parse(`${hasta}T00:00:00Z`); t += 86_400_000) {
    const fecha = new Date(t);
    const anio = fecha.getUTCFullYear();
    const mes = fecha.getUTCMonth() + 1;
    const dia = fecha.getUTCDate();
    const diaSemana = ((fecha.getUTCDay() + 6) % 7) + 1;
    if (!feriadosPorAnio.has(anio)) feriadosPorAnio.set(anio, feriadosDeBolivia(anio));
    const { semana, anioIso } = semanaIso(fecha);
    const fechaTexto = clave(fecha);
    dias.push({
      fechaKey: anio * 10000 + mes * 100 + dia,
      fecha: fechaTexto,
      anio,
      trimestre: Math.ceil(mes / 3),
      mes,
      nombreMes: MESES[mes - 1],
      semanaIso: semana,
      anioIso,
      dia,
      diaSemana,
      nombreDia: DIAS[diaSemana - 1],
      esFinDeSemana: diaSemana >= 6,
      feriado: feriadosPorAnio.get(anio)?.get(fechaTexto) ?? null,
      temporada: temporadaDe(mes, dia),
    });
  }
  return dias;
}

function semanaIso(fecha: Date): { semana: number; anioIso: number } {
  const jueves = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  jueves.setUTCDate(jueves.getUTCDate() + 4 - (((jueves.getUTCDay() + 6) % 7) + 1));
  const inicioAnio = Date.UTC(jueves.getUTCFullYear(), 0, 1);
  return { semana: Math.ceil(((jueves.getTime() - inicioAnio) / 86_400_000 + 1) / 7), anioIso: jueves.getUTCFullYear() };
}

function clave(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

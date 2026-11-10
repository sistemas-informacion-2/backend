/** Una tabla del Data Warehouse y el SQL que la llena para una empresa (`$1` = id de la empresa). */
export interface CargaEtl {
  tabla: string;
  /**
   * DIMENSION: el SQL inserta o actualiza (nunca se borra).
   * HECHO: antes del SQL se borran las filas de la empresa; el SQL las vuelve a insertar todas.
   */
  tipo: 'DIMENSION' | 'HECHO';
  sql: string;
}

/** AAAAMMDD de una expresion de fecha o timestamp de Postgres. */
export function fechaKey(expresion: string): string {
  return `to_char(${expresion}, 'YYYYMMDD')::int`;
}

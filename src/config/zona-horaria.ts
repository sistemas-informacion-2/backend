import { ZONA_HORARIA } from '../common/utils/fecha.util.js';

/**
 * Reloj del proceso en la zona de Bolivia. Se importa primero en cada punto de
 * entrada (main.ts, data-source.ts, initial.seeder.ts): asi los Date que el
 * driver de Postgres escribe en columnas `timestamp` quedan en hora de La Paz,
 * igual que las fechas de negocio de fecha.util. Si el entorno ya define TZ
 * (Docker, Railway), se respeta.
 */
process.env.TZ ||= ZONA_HORARIA;

import 'reflect-metadata';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import configuration from '../config/configuration.js';
import { opcionesConexion } from './database.config.js';

/**
 * DataSource que usa la CLI de TypeORM (scripts migration:* de package.json),
 * siempre sobre el codigo compilado en dist.
 *
 * Fuera de Docker las variables vienen de backend/.env; dentro de Docker o en
 * EC2 ya estan en el entorno y el archivo no existe.
 */
try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usan las variables del entorno.
}

const DIRECTORIO_SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

export default new DataSource({
  ...opcionesConexion(configuration().database),
  entities: [join(DIRECTORIO_SRC, '**', '*.entity.js')],
});

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { DataSourceOptions } from 'typeorm';
import type { AppConfig } from '../config/configuration.js';
import { ZONA_HORARIA } from '../common/utils/fecha.util.js';

type PostgresOptions = Extract<DataSourceOptions, { type: 'postgres' }>;

const DIRECTORIO_DATABASE = dirname(fileURLToPath(import.meta.url));

// Solo *.js: en dist conviven las migraciones compiladas con sus .d.ts, y un
// glob con .ts cargaria tambien las declaraciones.
const MIGRACIONES = join(DIRECTORIO_DATABASE, 'migrations', '*.js');

/**
 * Opciones de conexion compartidas por la app (Nest) y por la CLI de TypeORM
 * (data-source.ts), para que ambas apunten a la misma base con las mismas
 * migraciones.
 */
export function opcionesConexion(database: AppConfig['database']): PostgresOptions {
  return {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.name,
    // Cada sesion de Postgres en hora de Bolivia: CURRENT_DATE, now() y los DEFAULT CURRENT_TIMESTAMP coinciden
    // con las fechas que arma el backend (fecha.util). No requiere permisos sobre la base (a diferencia de ALTER DATABASE).
    extra: { options: `-c TimeZone=${ZONA_HORARIA}` },
    // El esquema lo cambian solo las migraciones, en todos los entornos:
    // synchronize podia borrar columnas (y sus datos) al renombrar una entidad.
    synchronize: false,
    migrations: [MIGRACIONES],
  };
}

export function getDatabaseConfig(config: ConfigService<AppConfig, true>): TypeOrmModuleOptions {
  return {
    ...opcionesConexion(config.get('database', { infer: true })),
    autoLoadEntities: true,
    // Al arrancar se aplican las migraciones pendientes, antes que los seeders de main.ts.
    migrationsRun: true,
    retryAttempts: 10,
    retryDelay: 3000,
  };
}

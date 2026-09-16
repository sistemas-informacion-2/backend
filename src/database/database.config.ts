import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { AppConfig } from '../config/configuration.js';

export function getDatabaseConfig(config: ConfigService<AppConfig, true>): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: config.get('database.host', { infer: true }),
    port: config.get('database.port', { infer: true }),
    username: config.get('database.username', { infer: true }),
    password: config.get('database.password', { infer: true }),
    database: config.get('database.name', { infer: true }),
    autoLoadEntities: true,
    // Sincroniza el esquema a partir de las entidades. Practico en
    // desarrollo, destructivo en produccion: alli usa migraciones.
    synchronize: config.get('nodeEnv', { infer: true }) !== 'production',
    retryAttempts: 10,
    retryDelay: 3000,
  };
}

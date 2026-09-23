import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'node:path';
import express from 'express';
import { AppModule } from './app.module.js';
import { AppValidationPipe } from './common/pipes/validation.pipe.js';
import type { AppConfig } from './config/configuration.js';
import { InitialSeederService } from './database/seeders/initial-seeder.service.js';
import { UbicacionSeederService } from './modules/operaciones/seeders/ubicacion-seeder.service.js';
import { PasarelaSeederService } from './modules/comercial/seeders/pasarela-seeder.service.js';
import { CategoriaSeederService } from './modules/inventario/seeders/categoria-seeder.service.js';
import { TemporadaSeederService } from './modules/inventario/seeders/temporada-seeder.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);

  app.enableCors({ origin: config.get('corsOrigin', { infer: true }) });
  app.setGlobalPrefix('api');

  const server = app.getHttpAdapter().getInstance();
  // Azure App Service termina TLS en su front end y reenvia la peticion por
  // HTTP. Confiar en ese unico salto hace que request.protocol lea
  // X-Forwarded-Proto (URLs https de uploads) y que request.ip sea la IP real
  // del cliente en la bitacora. "1" y no "true": con "true" cualquier cliente
  // podria falsear su IP enviando su propio X-Forwarded-For.
  server.set('trust proxy', 1);
  server.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  // Node cierra las conexiones keep-alive a los 5s por defecto; si el navegador
  // reutiliza una conexion ya cerrada, la primera peticion tras inactividad
  // falla con ERR_EMPTY_RESPONSE. Con un timeout mas alto que el del cliente se
  // evita ese corte.
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  app.useGlobalPipes(new AppValidationPipe());

  // Idempotente: crea permisos base, rol ADMINISTRADOR y el usuario admin
  // (SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD) si todavia no existen.
  await app.get(InitialSeederService).run();
  // Idempotente: siembra los 9 departamentos de Bolivia como referencia fija.
  await app.get(UbicacionSeederService).run();
  // Idempotente: siembra los metodos de pago base (CU16).
  await app.get(PasarelaSeederService).run();
  // Idempotente: siembra la taxonomia de categorias de ropa con su zona para el probador virtual (CU19).
  await app.get(CategoriaSeederService).run();
  // Idempotente: siembra las 4 estaciones (hemisferio sur / Bolivia) para el filtro de temporadas.
  await app.get(TemporadaSeederService).run();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('FashionStore API')
    .setDescription('API del sistema FashionStore')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(config.get('port', { infer: true }), '0.0.0.0');
}
await bootstrap();

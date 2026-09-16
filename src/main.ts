import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { AppValidationPipe } from './common/pipes/validation.pipe.js';
import type { AppConfig } from './config/configuration.js';
import { InitialSeederService } from './database/seeders/initial-seeder.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);

  app.enableCors({ origin: config.get('corsOrigin', { infer: true }) });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new AppValidationPipe());

  // Idempotente: crea permisos base, rol ADMINISTRADOR y el usuario admin
  // (SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD) si todavia no existen.
  await app.get(InitialSeederService).run();

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

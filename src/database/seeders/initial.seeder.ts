import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module.js';
import { InitialSeederService } from './initial-seeder.service.js';

const app = await NestFactory.createApplicationContext(AppModule);
await app.get(InitialSeederService).run();
await app.close();
console.log('Seed completado.');

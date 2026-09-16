import { ValidationPipe } from '@nestjs/common';

/**
 * Pipe de validacion global de la app: descarta campos no declarados en el
 * DTO, transforma tipos primitivos segun el DTO y rechaza el request si
 * llegan propiedades extra no esperadas.
 */
export class AppValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    });
  }
}

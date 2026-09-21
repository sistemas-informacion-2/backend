import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { IntegracionPago } from '../entities/pasarela-pago.entity.js';

export class CrearPasarelaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9_]+$/, { message: 'El codigo solo admite letras, numeros y guion bajo' })
  codigo: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  metodo: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @IsOptional()
  @IsIn(['NINGUNA', 'API'])
  integracion?: IntegracionPago;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  comisionPorcentaje?: number;

  @IsOptional()
  @IsBoolean()
  disponiblePresencial?: boolean;

  @IsOptional()
  @IsBoolean()
  disponibleLinea?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  apiSecret?: string;
}

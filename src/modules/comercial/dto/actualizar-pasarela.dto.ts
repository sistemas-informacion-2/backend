import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { IntegracionPago } from '../entities/pasarela-pago.entity.js';

export class ActualizarPasarelaDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  metodo?: string;

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

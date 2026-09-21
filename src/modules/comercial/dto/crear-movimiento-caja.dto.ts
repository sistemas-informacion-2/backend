import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { TipoMovimientoCaja } from '../entities/movimiento-caja.entity.js';

export class CrearMovimientoCajaDto {
  @IsIn(['INGRESO', 'EGRESO'])
  tipo: TipoMovimientoCaja;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  concepto: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}

import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional } from 'class-validator';
import type { EstadoCaja } from '../entities/caja.entity.js';

export class CajasQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idSucursal?: number;

  @IsOptional()
  @IsIn(['Abierta', 'Cerrada'])
  estado?: EstadoCaja;

  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaHasta?: string;
}

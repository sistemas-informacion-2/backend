import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class BitacoraQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  usuarioId?: number;

  @IsOptional()
  @IsString()
  tablaAfectada?: string;

  @IsOptional()
  @IsIn(['POST', 'PUT', 'PATCH', 'DELETE'])
  operacion?: string;

  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;
}
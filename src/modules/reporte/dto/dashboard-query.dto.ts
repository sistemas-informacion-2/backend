import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DIAS_DASHBOARD_POR_DEFECTO = 7;

export class DashboardQueryDto {
  /** Vista por sucursal; sin valor es la Vista General (todas las sucursales). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idSucursal?: number;

  /** Ventana en dias (incluye hoy) para la tendencia, el comparativo y el top de variantes. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  dias?: number;
}

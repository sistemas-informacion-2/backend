import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CrearStockDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idAlmacen: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  idVarianteProducto: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockDisponible?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockMinimo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockMaximo?: number;

  /** Costo por unidad del stock inicial: alimenta el costo promedio de la variante (base del margen). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  costoUnitario?: number;
}

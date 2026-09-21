import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

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
}

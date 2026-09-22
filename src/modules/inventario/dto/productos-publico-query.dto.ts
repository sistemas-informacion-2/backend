import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class ProductosPublicoQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idCategoria?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idTemporada?: number;

  /** Catálogo de una sucursal puntual (CU08): solo productos activos ahí (`producto_sucursal`). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idSucursal?: number;

  /** Solo productos con descuento (`?soloOfertas=true`). */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  soloOfertas?: boolean;
}

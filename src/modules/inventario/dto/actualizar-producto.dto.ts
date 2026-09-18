import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class ActualizarProductoDto {
  @IsOptional()
  @IsInt()
  idCategoria?: number;

  @IsOptional()
  @IsInt()
  idSucursal?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precio?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

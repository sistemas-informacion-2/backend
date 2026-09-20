import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ActualizarVarianteProductoDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  talla?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  corte?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  modelo3dUrl?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

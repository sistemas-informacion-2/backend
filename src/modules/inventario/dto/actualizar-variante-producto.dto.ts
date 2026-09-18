import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const PATRON_HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

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
  @Matches(PATRON_HEX, { message: 'codigoHexColor debe ser un color hex válido (ej. "#FF00AA")' })
  codigoHexColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  modelo3dUrl?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

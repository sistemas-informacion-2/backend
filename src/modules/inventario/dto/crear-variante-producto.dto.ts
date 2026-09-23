import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CrearVarianteProductoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sku: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  talla: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  color: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  corte: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  modelo3dUrl?: string;
}

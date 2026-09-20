import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CrearImagenProductoDto } from './crear-imagen-producto.dto.js';
import { CrearVarianteProductoDto } from './crear-variante-producto.dto.js';

export class CrearProductoDto {
  @IsInt()
  idCategoria: number;

  /** Sucursales donde queda activo desde el alta; el producto en si es global y no se duplica por sede. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  sucursalIds?: number[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precio: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearImagenProductoDto)
  imagenes?: CrearImagenProductoDto[];

  @IsArray()
  @ArrayMinSize(1, { message: 'El producto debe tener al menos una variante' })
  @ValidateNested({ each: true })
  @Type(() => CrearVarianteProductoDto)
  variantes: CrearVarianteProductoDto[];
}

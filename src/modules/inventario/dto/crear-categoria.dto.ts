import { ArrayUnique, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import type { ZonaProbador } from '../entities/categoria.entity.js';

const PATRON_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ZONAS_PROBADOR: ZonaProbador[] = ['SUPERIOR', 'INFERIOR', 'COMPLETO'];

export class CrearCategoriaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(PATRON_SLUG, { message: 'slug solo puede contener minúsculas, números y guiones (ej. "ropa-mujer")' })
  slug: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imagenUrl?: string;

  @IsOptional()
  @IsInt()
  categoriaPadreId?: number;

  /** Que parte del cuerpo ancla el probador virtual (CU19) para las prendas de esta categoría. Por defecto SUPERIOR. */
  @IsOptional()
  @IsIn(ZONAS_PROBADOR)
  zonaProbador?: ZonaProbador;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  temporadaIds?: number[];
}

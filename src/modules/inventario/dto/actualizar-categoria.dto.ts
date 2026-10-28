import { ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

const PATRON_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class ActualizarCategoriaDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(PATRON_SLUG, { message: 'slug solo puede contener minúsculas, números y guiones (ej. "ropa-mujer")' })
  slug?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imagenUrl?: string;

  @IsOptional()
  @IsInt()
  categoriaPadreId?: number | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  temporadaIds?: number[];
}

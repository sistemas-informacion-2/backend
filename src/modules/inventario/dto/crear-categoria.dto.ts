import { ArrayUnique, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

const PATRON_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  temporadaIds?: number[];
}

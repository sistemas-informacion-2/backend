export class TemporadaResumenDto {
  id: number;
  nombre: string;
}

export class CategoriaResponseDto {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string | null;
  imagenUrl: string | null;
  activo: boolean;
  categoriaPadreId: number | null;
  temporadas: TemporadaResumenDto[];
  hijos: CategoriaResponseDto[];
}

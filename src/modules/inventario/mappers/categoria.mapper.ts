import type { Categoria } from '../entities/categoria.entity.js';
import type { CategoriaResponseDto } from '../dto/categoria-response.dto.js';

export function toCategoriaResponseDto(categoria: Categoria): CategoriaResponseDto {
  return {
    id: categoria.id,
    nombre: categoria.nombre,
    slug: categoria.slug,
    descripcion: categoria.descripcion,
    imagenUrl: categoria.imagenUrl,
    activo: categoria.activo,
    categoriaPadreId: categoria.idCategoriaPadre,
    temporadas: (categoria.temporadasCategoria ?? [])
      .map((tc) => tc.temporada)
      .filter((temporada) => !!temporada)
      .map((temporada) => ({ id: temporada.id, nombre: temporada.nombre })),
    hijos: [],
  };
}

/** Arma el arbol (categoria_padre_id) a partir de la lista plana que devuelve el repositorio, tal como pide CU08. */
export function construirArbolCategorias(categorias: Categoria[]): CategoriaResponseDto[] {
  const nodosPorId = new Map<number, CategoriaResponseDto>();
  for (const categoria of categorias) {
    nodosPorId.set(categoria.id, toCategoriaResponseDto(categoria));
  }

  const raices: CategoriaResponseDto[] = [];
  for (const categoria of categorias) {
    const nodo = nodosPorId.get(categoria.id)!;
    if (categoria.idCategoriaPadre === null) {
      raices.push(nodo);
      continue;
    }
    const padre = nodosPorId.get(categoria.idCategoriaPadre);
    // Si el padre no vino en la lista (p.ej. esta inactivo y se pidio solo activas), la tratamos como raiz.
    if (padre) padre.hijos.push(nodo);
    else raices.push(nodo);
  }

  return raices;
}

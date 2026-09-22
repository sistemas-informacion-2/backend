export class ProbadorImagenDto {
  id: number;
  url: string;
  esPrincipal: boolean;
  orden: number;
}

export class ProbadorProductoDto {
  id: number;
  nombre: string;
  descripcion: string | null;
}

/**
 * Assets que el probador virtual (CU19) necesita para superponer la prenda:
 * la descripción de la variante (talla, color, corte), el enlace opcional al
 * modelo 3D y las capas de imagen del producto para el canvas.
 */
export class ProbadorVarianteDto {
  id: number;
  sku: string;
  talla: string;
  color: string;
  corte: string;
  modelo3dUrl: string | null;
  /** Zona del cuerpo (hombros/cadera/completo) que la categoría del producto usa para anclar el modelo 3D. */
  zonaProbador: 'SUPERIOR' | 'INFERIOR' | 'COMPLETO';
  producto: ProbadorProductoDto;
  imagenes: ProbadorImagenDto[];
}
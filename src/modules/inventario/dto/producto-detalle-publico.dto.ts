import type { ImagenProductoResponseDto } from './producto-response.dto.js';

export class VariantePublicaDto {
  id: number;
  sku: string;
  talla: string;
  color: string;
  corte: string;
  /** Unidades que se pueden comprar en linea; 0 = agotado. */
  stockDisponible: number;
}

export class ProductoDetallePublicoDto {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  descuentoPorcentaje: number;
  /** Precio con el descuento ya aplicado. */
  precioFinal: number;
  categoriaId: number;
  categoriaNombre: string;
  imagenes: ImagenProductoResponseDto[];
  variantes: VariantePublicaDto[];
}

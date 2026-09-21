export class ImagenProductoResponseDto {
  id: number;
  url: string;
  esPrincipal: boolean;
  orden: number;
}

export class VarianteProductoResponseDto {
  id: number;
  sku: string;
  talla: string;
  color: string;
  corte: string;
  modelo3dUrl: string | null;
  activo: boolean;
}

export class SucursalActivaResponseDto {
  id: number;
  nombre: string;
  activo: boolean;
}

export class ProductoResponseDto {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  descuentoPorcentaje: number;
  activo: boolean;
  categoriaId: number;
  categoriaNombre: string;
  sucursales: SucursalActivaResponseDto[];
  imagenes: ImagenProductoResponseDto[];
  variantes: VarianteProductoResponseDto[];
}

export class ProductosPaginatedResponseDto {
  items: ProductoResponseDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

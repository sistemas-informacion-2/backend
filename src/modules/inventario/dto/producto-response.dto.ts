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
  codigoHexColor: string | null;
  modelo3dUrl: string | null;
  activo: boolean;
}

export class ProductoResponseDto {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  activo: boolean;
  categoriaId: number;
  categoriaNombre: string;
  sucursalId: number | null;
  sucursalNombre: string | null;
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

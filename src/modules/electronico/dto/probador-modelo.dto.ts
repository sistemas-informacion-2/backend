export class ProbadorModeloProductoDto {
  id: number;
  nombre: string;
}

/**
 * Variante tal como la ve la seccion admin del probador virtual: la descripcion
 * de la variante y el enlace a su modelo 3D (.glb, exportado de Blender).
 */
export class ProbadorVarianteAdminDto {
  id: number;
  sku: string;
  talla: string;
  color: string;
  corte: string;
  modelo3dUrl: string | null;
  producto: ProbadorModeloProductoDto;
}

import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Tope por linea: evita cantidades absurdas aunque el stock sea enorme. */
export const CANTIDAD_MAXIMA_POR_ITEM = 100;

export class AgregarItemCarritoDto {
  @IsInt()
  @Min(1)
  idVarianteProducto: number;

  /** Sucursal elegida en el catálogo: de ahí sale el stock al pagar (CU14). Fija/actualiza la del carrito. */
  @IsInt()
  @Min(1)
  idSucursal: number;

  @IsInt()
  @Min(1)
  @Max(CANTIDAD_MAXIMA_POR_ITEM)
  cantidad: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notasEspeciales?: string;
}

export class ActualizarItemCarritoDto {
  @IsInt()
  @Min(1)
  @Max(CANTIDAD_MAXIMA_POR_ITEM)
  cantidad: number;
}

export class ItemCarritoResponseDto {
  id: number;
  idVarianteProducto: number;
  idProducto: number;
  productoNombre: string;
  sku: string;
  talla: string;
  color: string;
  corte: string;
  imagenUrl: string | null;
  /** Precio vigente con descuento. */
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
  notasEspeciales: string | null;
  /** Unidades compradas en linea que hay hoy de esta variante. */
  stockDisponible: number;
  /** false si el stock ya no alcanza para la cantidad del carrito (o la variante se desactivo). */
  disponible: boolean;
}

export class CarritoResponseDto {
  /** null mientras el cliente no haya agregado nada (el carrito se crea con el primer item). */
  id: number | null;
  /** Sucursal de la que sale el stock al pagar; null en el mismo caso que `id`. */
  idSucursal: number | null;
  items: ItemCarritoResponseDto[];
  cantidadTotal: number;
  total: number;
  fechaActualizacion: Date | null;
}

import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { MotivoDevolucion, TipoDevolucion } from '../entities/nota-devolucion.entity.js';
import type { EstadoProductoDevolucion } from '../entities/detalle-nota-devolucion.entity.js';

type EstadoProducto = EstadoProductoDevolucion;

/** Dias desde la emision de la nota de venta durante los que se acepta una devolucion sin autorizacion. */
export const PLAZO_DEVOLUCION_DIAS = 30;

export const MOTIVOS_DEVOLUCION: MotivoDevolucion[] = ['FALLA_FABRICA', 'TALLA_INCORRECTA', 'ARREPENTIMIENTO', 'CANCELACION'];
export const TIPOS_DEVOLUCION: TipoDevolucion[] = ['PRODUCTO_ENTREGADO', 'CANCELACION_RESERVA'];
/** Una prenda fisica solo puede reingresar o ir a merma; NO_APLICA es para el reembolso puramente financiero. */
export const ESTADOS_PRENDA_DEVUELTA: EstadoProducto[] = ['REINGRESO_INVENTARIO', 'MERMA_DEFECTUOSO'];

export class OrigenDevolucionQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigoNota?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigoReserva?: string;
}

export class ItemDevolucionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idVarianteProducto: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  cantidad: number;

  /** Almacen que recibe la prenda; obligatorio cuando vuelve al inventario. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idAlmacen?: number;

  @IsIn(ESTADOS_PRENDA_DEVUELTA)
  estadoProducto: EstadoProducto;
}

export class CrearDevolucionDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigoNota?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigoReserva?: string;

  /** Sucursal receptora: obligatoria para el administrador; el cajero usa la de su token. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idSucursal?: number;

  /** Solo lo usa el administrador (no tiene legajo de empleado): cajero responsable, asignado a la sucursal. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCajero?: number;

  @IsIn(MOTIVOS_DEVOLUCION)
  motivoDevolucion: MotivoDevolucion;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;

  /** Metodo con el que se entrega el reembolso (habilitado en caja). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idPasarela?: number;

  /** Solo el administrador puede aceptar una devolucion fuera del plazo. */
  @IsOptional()
  @IsBoolean()
  autorizarFueraDePlazo?: boolean;

  /** Prendas devueltas de una nota de venta; se ignora en la cancelacion de una reserva. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemDevolucionDto)
  items?: ItemDevolucionDto[];
}

export class DevolucionesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(TIPOS_DEVOLUCION)
  tipoDevolucion?: TipoDevolucion;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idSucursal?: number;

  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaHasta?: string;
}

export class LineaOrigenDevolucionDto {
  idVarianteProducto: number;
  sku: string;
  descripcion: string;
  /** Lo que se reembolsa por unidad: precio pagado, ya prorrateado con el descuento/impuesto de la nota. */
  precioReembolsable: number;
  cantidadComprada: number;
  cantidadDevuelta: number;
  cantidadDisponible: number;
}

export class OrigenDevolucionResponseDto {
  tipoDevolucion: TipoDevolucion;
  idNotaVenta: number | null;
  idReserva: number | null;
  codigo: string;
  idCliente: number;
  clienteNombre: string;
  idSucursal: number;
  sucursalNombre: string;
  /** Fecha de emision de la nota (ISO); para reservas, la de la reserva. */
  fecha: string;
  plazoDias: number;
  dentroDePlazo: boolean;
  /** Maximo que se puede reembolsar todavia. */
  montoReembolsable: number;
  lineas: LineaOrigenDevolucionDto[];
}

export class DetalleDevolucionResponseDto {
  id: number;
  idVarianteProducto: number | null;
  sku: string | null;
  productoNombre: string | null;
  descripcion: string;
  idAlmacen: number | null;
  almacenNombre: string | null;
  precioUnitario: number;
  cantidad: number;
  montoSubtotal: number;
  estadoProducto: EstadoProductoDevolucion;
}

export class DevolucionResponseDto {
  id: number;
  codigoDevolucion: string;
  tipoDevolucion: TipoDevolucion;
  motivoDevolucion: MotivoDevolucion;
  idCliente: number;
  clienteNombre: string;
  idSucursal: number;
  sucursalNombre: string;
  idCajero: number;
  cajeroNombre: string;
  idNotaVenta: number | null;
  codigoNota: string | null;
  idReserva: number | null;
  codigoReserva: string | null;
  idMovimientoCaja: number | null;
  montoTotalReembolsado: number;
  observaciones: string | null;
  fechaEmision: Date;
  detalles: DetalleDevolucionResponseDto[];
}

export class DevolucionesPaginatedResponseDto {
  items: DevolucionResponseDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

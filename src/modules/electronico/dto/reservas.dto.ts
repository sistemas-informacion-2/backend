import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { ConceptoPago } from '../../comercial/entities/pago.entity.js';
import type { EstadoReserva } from '../entities/reserva.entity.js';

/** Porcentaje minimo del total que debe cubrir el anticipo de una reserva. */
export const PORCENTAJE_ANTICIPO_MINIMO = 20;
export const HORAS_LIMITE_POR_DEFECTO = 48;
export const HORAS_LIMITE_MAXIMO = 168;
export const CANTIDAD_MAXIMA_POR_LINEA = 20;

export const ESTADOS_RESERVA: EstadoReserva[] = ['PENDIENTE', 'PAGADA', 'CANCELADA', 'COMPLETADA'];

export class ItemReservaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idVarianteProducto: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CANTIDAD_MAXIMA_POR_LINEA)
  cantidad: number;
}

export class CrearReservaDto {
  /** Solo lo envia el personal; para un cliente se toma siempre del token. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente?: number;

  /** Obligatoria para clientes y administrador; el empleado usa la sucursal de su token. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idSucursal?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemReservaDto)
  items: ItemReservaDto[];

  /** Anticipo pactado; por defecto y como minimo el 20% del total. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoAnticipo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(HORAS_LIMITE_MAXIMO)
  horasLimite?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}

export class RegistrarAnticipoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idPasarela: number;
}

export class LiquidarReservaDto {
  /** Obligatoria mientras quede saldo por cobrar. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idPasarela?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nitRazonSocial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nroFactura?: string;
}

export class CancelarReservaDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}

export class ReservasQueryDto {
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
  @IsIn(ESTADOS_RESERVA)
  estado?: EstadoReserva;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idSucursal?: number;
}

export class DetalleReservaResponseDto {
  id: number;
  idVarianteProducto: number;
  idProducto: number;
  productoNombre: string;
  sku: string;
  talla: string;
  color: string;
  corte: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
}

export class PagoReservaResponseDto {
  id: number;
  concepto: ConceptoPago;
  monto: number;
  pasarelaMetodo: string | null;
  fechaPago: string;
  horaPago: string;
}

export class ReservaResponseDto {
  id: number;
  codigoReserva: string;
  idCliente: number;
  clienteNombre: string;
  idSucursal: number;
  sucursalNombre: string;
  fechaReserva: Date;
  fechaLimite: Date;
  estado: EstadoReserva;
  montoAnticipo: number;
  montoTotal: number;
  /** Suma de los pagos ANTICIPO_RESERVA ya cobrados. */
  anticipoPagado: number;
  /** Lo que falta cobrar para liquidar; 0 cuando la reserva ya termino. */
  saldoPendiente: number;
  observaciones: string | null;
  idNotaVenta: number | null;
  codigoNotaVenta: string | null;
  detalles: DetalleReservaResponseDto[];
  pagos: PagoReservaResponseDto[];
}

export class ReservasPaginatedResponseDto {
  items: ReservaResponseDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

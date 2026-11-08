import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsISO8601, IsNumber, Matches, Max, Min, ValidateNested } from 'class-validator';
import { CANTIDAD_MAXIMA_POR_LINEA } from './reservas.dto.js';

/** 409 cuando una prenda se agoto mientras el cliente estaba sin conexion. */
export const CODIGO_COMPRA_SIN_STOCK = 'COMPRA_RECHAZADA_STOCK_AGOTADO';
/** Formato del id que genera el navegador. `off_` es el de las compras guardadas antes de este formato. */
export const FORMATO_ID_LOCAL = /^(compra_)?off_[A-Za-z0-9_-]{6,36}$/;

export class DetalleCompraOfflineDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idVariante: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CANTIDAD_MAXIMA_POR_LINEA)
  cantidad: number;

  /** Precio que vio el cliente sin conexion. Solo informativo: siempre se cobra el vigente. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioUnitario: number;
}

/**
 * RF-SYNC-01. Compra directa hecha sin conexion. El cliente sale siempre del token, nunca del cuerpo, y no viaja
 * ningun dato de pago: sin red no se cobra nada.
 */
export class SincronizarCompraOfflineDto {
  @Matches(FORMATO_ID_LOCAL, { message: 'El identificador local de la compra no es valido' })
  idLocal: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  idSucursal: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DetalleCompraOfflineDto)
  detalles: DetalleCompraOfflineDto[];

  /** Cuando el cliente confirmo la compra sin conexion (ISO 8601). */
  @IsISO8601()
  fechaCreacion: string;
}

export interface EstadoCompraOfflineDto {
  idLocal: string;
  /** PENDIENTE_PAGO: hay stock y el total se paga en el checkout. COMPLETADA: ya tiene su Nota de Venta. */
  estadoSincronizacion: 'PENDIENTE_PAGO' | 'COMPLETADA';
  montoTotal: number;
  codigoNota: string | null;
  /** true si algun precio cambio mientras el cliente estaba sin conexion. */
  preciosActualizados: boolean;
}

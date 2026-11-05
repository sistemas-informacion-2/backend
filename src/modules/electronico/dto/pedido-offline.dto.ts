
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsISO8601, IsNumber, Matches, Max, Min, ValidateNested } from 'class-validator';
import { CANTIDAD_MAXIMA_POR_LINEA, type ReservaResponseDto } from './reservas.dto.js';

/** Codigo de error del 409 cuando el stock se agoto mientras el cliente estaba sin conexion. */
export const CODIGO_STOCK_AGOTADO_COLISION = 'STOCK_AGOTADO_COLISION';
/** Codigo de error del 409 cuando el cliente ya tiene el maximo de reservas vivas. */
export const CODIGO_LIMITE_RESERVAS = 'LIMITE_RESERVAS';

export class DetallePedidoOfflineDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idVariante: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CANTIDAD_MAXIMA_POR_LINEA)
  cantidad: number;

  /** Precio que vio el cliente sin conexion. Solo informativo: se reserva siempre al precio vigente. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioUnitario: number;
}

/**
 * RF-SYNC-01. Pedido armado sin conexion y enviado despues por la cola de Background Sync. El cliente sale
 * siempre del token (nunca del cuerpo): un pedido encolado no puede quedar a nombre de otra persona.
 */
export class SincronizarPedidoOfflineDto {
  /** Id generado en el navegador ("off_<...>"): hace idempotente el reenvio del mismo pedido. */
  @Matches(/^off_[A-Za-z0-9_-]{6,36}$/, { message: 'El identificador local del pedido no es valido' })
  idLocal: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  idSucursal: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DetallePedidoOfflineDto)
  detalles: DetallePedidoOfflineDto[];

  /** Cuando el cliente confirmo el pedido sin conexion (ISO 8601). */
  @IsISO8601()
  fechaCreacion: string;
}

export class ItemSinStockDto {
  id_variante: number;
  stock_solicitado: number;
  stock_actual: number;
}

export class PedidoOfflineSincronizadoDto {
  idLocal: string;
  estadoSincronizacion: 'SINCRONIZADO';
  /** true si el pedido ya habia llegado antes (reenvio de la cola): no se creo otra reserva. */
  duplicado: boolean;
  /** true si algun precio cambio mientras el cliente estaba sin conexion (se reservo al precio vigente). */
  preciosActualizados: boolean;
  reserva: ReservaResponseDto;
}

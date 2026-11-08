import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiConflictResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { FORMATO_ID_LOCAL, SincronizarCompraOfflineDto, type EstadoCompraOfflineDto } from '../dto/compra-offline.dto.js';
import { ComprasOfflineService } from '../services/compras-offline.service.js';

/**
 * RF-SYNC-01. Recibe las compras que el cliente confirmo sin conexion y que el Service Worker reenvia al volver la red
 * (cola "cola-compras-offline"). Sin permiso asignable: el servicio exige que sea cliente y usa el id del JWT.
 */
@ApiTags('Electronico')
@Controller('electronico/checkout')
export class CheckoutOfflineController {
  constructor(private readonly comprasOffline: ComprasOfflineService) {}

  @Post('sync')
  @ApiOperation({ summary: 'Valida el stock de una compra hecha sin conexion y la deja lista para pagar el total' })
  @ApiConflictResponse({ description: 'COMPRA_RECHAZADA_STOCK_AGOTADO (con items_afectados)' })
  sincronizar(@Body() dto: SincronizarCompraOfflineDto, @CurrentUser() usuario: ActiveUser): Promise<EstadoCompraOfflineDto> {
    return this.comprasOffline.sincronizar(dto, usuario);
  }

  @Get('sync/:idLocal')
  @ApiOperation({ summary: 'Indica si una compra hecha sin conexion ya tiene su Nota de Venta' })
  estado(@Param('idLocal') idLocal: string, @CurrentUser() usuario: ActiveUser): Promise<EstadoCompraOfflineDto> {
    if (!FORMATO_ID_LOCAL.test(idLocal)) throw new BadRequestException('El identificador local de la compra no es valido');
    return this.comprasOffline.estado(idLocal, usuario);
  }
}

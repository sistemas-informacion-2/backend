import { Body, Controller, Post } from '@nestjs/common';
import { ApiConflictResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { SincronizarPedidoOfflineDto, type PedidoOfflineSincronizadoDto } from '../dto/pedido-offline.dto.js';
import { ReservasService } from '../services/reservas.service.js';

/**
 * RF-SYNC-01. Recibe los pedidos que el cliente confirmo sin conexion y que el Service Worker reenvia al volver la
 * red (cola "cola-compras-offline"). Sin permiso asignable: el servicio exige que sea cliente y usa el id del JWT.
 */
@ApiTags('Electronico')
@Controller('electronico/checkout')
export class CheckoutOfflineController {
  constructor(private readonly reservasService: ReservasService) {}

  @Post('sync')
  @ApiOperation({ summary: 'Sincroniza un pedido hecho sin conexion: lo convierte en una reserva PENDIENTE para retiro' })
  @ApiConflictResponse({ description: 'STOCK_AGOTADO_COLISION (con items_afectados) o LIMITE_RESERVAS' })
  sincronizar(@Body() dto: SincronizarPedidoOfflineDto, @CurrentUser() usuario: ActiveUser): Promise<PedidoOfflineSincronizadoDto> {
    return this.reservasService.sincronizarPedidoOffline(dto, usuario);
  }
}

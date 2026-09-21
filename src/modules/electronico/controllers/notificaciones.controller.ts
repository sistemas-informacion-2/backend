import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { NotificacionesService } from '../services/notificaciones.service.js';
import { CrearNotificacionDto } from '../dto/crear-notificacion.dto.js';
import { NotificacionesQueryDto } from '../dto/notificaciones-query.dto.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import type {
  DestinatarioResponseDto,
  EnvioNotificacionResponseDto,
  NotificacionResponseDto,
  NotificacionesPaginatedResponseDto,
} from '../dto/notificacion-response.dto.js';

@ApiTags('Electronico')
@Controller('electronico/notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  @RequirePermission('electronico:notificaciones:gestionar')
  @ApiOperation({ summary: 'Lista el historial de notificaciones (uso administrativo)' })
  listar(@Query() query: NotificacionesQueryDto): Promise<NotificacionesPaginatedResponseDto> {
    return this.notificacionesService.listar(query);
  }

  @Get('destinatarios')
  @RequirePermission('electronico:notificaciones:gestionar')
  @ApiOperation({ summary: 'Lista los clientes disponibles como destinatarios' })
  listarDestinatarios(): Promise<DestinatarioResponseDto[]> {
    return this.notificacionesService.listarDestinatarios();
  }

  @Get('mias')
  @ApiOperation({ summary: 'Lista las notificaciones del usuario autenticado' })
  listarMias(
    @CurrentUser() user: ActiveUser,
    @Query() query: NotificacionesQueryDto,
  ): Promise<NotificacionesPaginatedResponseDto> {
    return this.notificacionesService.listarMias(user.sub, query);
  }

  @Get('mias/no-leidas')
  @ApiOperation({ summary: 'Cuenta las notificaciones no leidas del usuario autenticado' })
  contarNoLeidas(@CurrentUser() user: ActiveUser): Promise<{ noLeidas: number }> {
    return this.notificacionesService.contarNoLeidas(user.sub);
  }

  @Patch('mias/leer-todas')
  @ApiOperation({ summary: 'Marca como leidas todas las notificaciones del usuario autenticado' })
  marcarTodasLeidas(@CurrentUser() user: ActiveUser): Promise<{ cantidadActualizada: number }> {
    return this.notificacionesService.marcarTodasLeidas(user.sub);
  }

  @Patch('mias/:id/leido')
  @ApiOperation({ summary: 'Marca como leida una notificacion propia' })
  marcarLeido(
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<NotificacionResponseDto> {
    return this.notificacionesService.marcarLeido(user.sub, id);
  }

  @Post()
  @RequirePermission('electronico:notificaciones:gestionar')
  @ApiOperation({ summary: 'Envia una notificacion a un usuario o difunde a todos los clientes' })
  enviar(@Body() dto: CrearNotificacionDto): Promise<EnvioNotificacionResponseDto> {
    return this.notificacionesService.enviar(dto);
  }

  @Delete(':id')
  @RequirePermission('electronico:notificaciones:gestionar')
  @ApiOperation({ summary: 'Elimina una notificacion enviada' })
  async eliminar(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.notificacionesService.eliminar(id);
  }
}

import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { RequierePlan } from '../../../common/decorators/plan.decorator.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { PreguntarDto, type ConversacionDetalleDto, type ConversacionResumenDto, type RespuestaAgenteDto } from '../agente/agente.dto.js';
import { AgenteService } from '../agente/agente.service.js';

@ApiTags('BI')
@RequierePlan('bi')
@Controller('bi')
@RequirePermission('analitica:bi:usar')
export class AgenteController {
  constructor(private readonly agente: AgenteService) {}

  @Post('preguntar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Pregunta al asistente del BI en lenguaje natural' })
  preguntar(@Body() dto: PreguntarDto, @CurrentUser() usuario: ActiveUser): Promise<RespuestaAgenteDto> {
    return this.agente.preguntar(dto, usuario);
  }

  @Get('conversaciones')
  @ApiOperation({ summary: 'Conversaciones del usuario con el asistente' })
  listar(@CurrentUser() usuario: ActiveUser): Promise<ConversacionResumenDto[]> {
    return this.agente.listarConversaciones(usuario.sub);
  }

  @Get('conversaciones/:id')
  @ApiOperation({ summary: 'Mensajes de una conversacion' })
  obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() usuario: ActiveUser): Promise<ConversacionDetalleDto> {
    return this.agente.obtenerConversacion(id, usuario.sub);
  }

  @Delete('conversaciones/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borra una conversacion' })
  borrar(@Param('id', ParseIntPipe) id: number, @CurrentUser() usuario: ActiveUser): Promise<void> {
    return this.agente.borrarConversacion(id, usuario.sub);
  }
}

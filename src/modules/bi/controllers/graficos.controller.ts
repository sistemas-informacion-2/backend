import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { RequierePlan } from '../../../common/decorators/plan.decorator.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { GuardarGraficoDto, type DatosGraficoDto, type GraficoGuardadoDto } from '../dto/modelos.dto.js';
import { GraficosService } from '../services/graficos.service.js';

@ApiTags('BI')
@RequierePlan('bi')
@Controller('bi/graficos')
@RequirePermission('analitica:bi:usar')
export class GraficosController {
  constructor(private readonly graficos: GraficosService) {}

  @Post()
  @ApiOperation({ summary: 'Guarda un grafico del asistente' })
  guardar(@Body() dto: GuardarGraficoDto, @CurrentUser() usuario: ActiveUser): Promise<GraficoGuardadoDto> {
    return this.graficos.guardar(dto, usuario.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Graficos guardados del usuario' })
  listar(@CurrentUser() usuario: ActiveUser): Promise<GraficoGuardadoDto[]> {
    return this.graficos.listar(usuario.sub);
  }

  @Get(':id/datos')
  @ApiOperation({ summary: 'Abre un grafico guardado, con los datos actuales' })
  datos(@Param('id', ParseIntPipe) id: number, @CurrentUser() usuario: ActiveUser): Promise<DatosGraficoDto> {
    return this.graficos.datos(id, usuario.sub);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borra un grafico guardado' })
  borrar(@Param('id', ParseIntPipe) id: number, @CurrentUser() usuario: ActiveUser): Promise<void> {
    return this.graficos.borrar(id, usuario.sub);
  }
}

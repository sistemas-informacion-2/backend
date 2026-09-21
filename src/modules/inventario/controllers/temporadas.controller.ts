import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { TemporadasService } from '../services/temporadas.service.js';
import { CrearTemporadaDto } from '../dto/crear-temporada.dto.js';
import { ActualizarTemporadaDto } from '../dto/actualizar-temporada.dto.js';
import type { TemporadaResponseDto } from '../dto/temporada-response.dto.js';
import type { TemporadaPublicaResponseDto } from '../dto/temporada-publica-response.dto.js';

@ApiTags('Inventario')
@Controller('inventario/temporadas')
@RequirePermission('inventario:temporadas:gestionar')
export class TemporadasController {
  constructor(private readonly temporadasService: TemporadasService) {}

  @Get()
  @ApiOperation({ summary: 'Lista las temporadas y su rango de vigencia' })
  listar(): Promise<TemporadaResponseDto[]> {
    return this.temporadasService.listar();
  }

  @Public()
  @RequirePermission()
  @Get('publicas')
  @ApiOperation({ summary: 'Temporadas para el menu del e-commerce publico' })
  listarPublicas(): Promise<TemporadaPublicaResponseDto[]> {
    return this.temporadasService.listarPublicas();
  }

  @Post()
  @ApiOperation({ summary: 'Crea una temporada' })
  crear(@Body() dto: CrearTemporadaDto): Promise<TemporadaResponseDto> {
    return this.temporadasService.crear(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualiza una temporada' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarTemporadaDto,
  ): Promise<TemporadaResponseDto> {
    return this.temporadasService.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina una temporada' })
  async eliminar(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.temporadasService.eliminar(id);
  }
}

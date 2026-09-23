import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import {
  CreateReportTemplateDto,
  ExportQueryDto,
  ReporteGenerativoRequestDto,
  ReporteGenerativoResponseDto,
  ReportResultDto,
  ReportRunRequestDto,
  ReportTemplateDto,
  ReportTypeDefinitionDto,
  UpdateReportTemplateDto,
} from '../dto/reporte-builder.dto.js';
import { ReportsService } from '../services/reports.service.js';

/**
 * CU18 Gestionar Reportes Dinámicos y Generativos. El catálogo es la
 * whitelist de campos; `run` ejecuta el builder, `export` descarga en
 * pdf/excel/html/json (respuesta binaria, sin envoltorio envelope) y
 * `generativo` interpreta pedidos por voz o texto en lenguaje natural.
 */
@ApiTags('Reporte')
@Controller('reports')
@RequirePermission('analitica:reportes:gestionar')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Catálogo de reportes dinámicos para el Report Builder' })
  catalogo(): ReportTypeDefinitionDto[] {
    return this.reportsService.catalogo();
  }

  @Post('run')
  @ApiOperation({ summary: 'Ejecuta un reporte dinámico con campos, filtros, orden y paginación' })
  ejecutar(@Body() request: ReportRunRequestDto): Promise<ReportResultDto> {
    return this.reportsService.ejecutar(request);
  }

  @Post('generativo')
  @ApiOperation({ summary: 'Interpreta un pedido en lenguaje natural (voz o texto) y genera el reporte' })
  generativo(@Body() body: ReporteGenerativoRequestDto): Promise<ReporteGenerativoResponseDto> {
    return this.reportsService.generativo(body.prompt);
  }

  @Post('export')
  @ApiOperation({ summary: 'Descarga el reporte actual en pdf, excel, html o json' })
  async exportar(
    @Query() query: ExportQueryDto,
    @Body() request: ReportRunRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    const archivo = await this.reportsService.exportar(query.format, request);
    res.set({
      'Content-Type': archivo.contentType,
      'Content-Disposition': `attachment; filename="${archivo.nombreArchivo}"`,
      'Content-Length': String(archivo.buffer.length),
    });
    res.send(archivo.buffer);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Lista las plantillas guardadas del usuario actual' })
  listarPlantillas(@CurrentUser() usuario: ActiveUser): Promise<ReportTemplateDto[]> {
    return this.reportsService.listarPlantillas(usuario.sub);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Guarda la configuración actual como plantilla' })
  crearPlantilla(
    @Body() body: CreateReportTemplateDto,
    @CurrentUser() usuario: ActiveUser,
  ): Promise<ReportTemplateDto> {
    return this.reportsService.crearPlantilla(usuario.sub, body);
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Actualiza una plantilla propia del usuario' })
  actualizarPlantilla(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateReportTemplateDto,
    @CurrentUser() usuario: ActiveUser,
  ): Promise<ReportTemplateDto> {
    return this.reportsService.actualizarPlantilla(usuario.sub, id, body);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Elimina una plantilla propia del usuario' })
  eliminarPlantilla(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: ActiveUser,
  ): Promise<void> {
    return this.reportsService.eliminarPlantilla(usuario.sub, id);
  }
}
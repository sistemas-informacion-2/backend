import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { RequierePlan } from '../../../common/decorators/plan.decorator.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import {
  CreateReportTemplateDto,
  ExportQueryDto,
  PaginaPredefinidoQueryDto,
  ReporteGenerativoRequestDto,
  ReporteGenerativoResponseDto,
  ReportePredefinidoDto,
  ReportePredefinidoEjecutadoDto,
  ReportResultDto,
  ReportRunRequestDto,
  ReportTemplateDto,
  ReportTypeDefinitionDto,
  UpdateReportTemplateDto,
} from '../dto/reporte-builder.dto.js';
import { ReportsService } from '../services/reports.service.js';
import type { ArchivoReporte } from '../utils/reporte-exportador.util.js';
import { ResumenReporteService } from '../exportacion/resumen-reporte.service.js';
import type { ResumenReporte } from '../exportacion/resumen.types.js';

/**
 * CU18 Gestionar Reportes Dinámicos y Generativos. El catálogo es la
 * whitelist de campos; `run` ejecuta el builder, `export` descarga en
 * pdf/excel/html (respuesta binaria, sin envoltorio envelope) y
 * `generativo` interpreta pedidos por voz o texto en lenguaje natural.
 *
 * Planes: el constructor (catalogo, run, export, plantillas) y el generativo son "reportes avanzados". Los
 * predefinidos (ver, ejecutar y exportar) estan en todos los planes: su configuracion la arma el servidor.
 */
@ApiTags('Reporte')
@Controller('reports')
@RequirePermission('analitica:reportes:gestionar')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly resumenService: ResumenReporteService,
  ) {}

  @Get('catalog')
  @RequierePlan('reportesAvanzados')
  @ApiOperation({ summary: 'Catálogo de reportes dinámicos para el Report Builder' })
  catalogo(): ReportTypeDefinitionDto[] {
    return this.reportsService.catalogo();
  }

  @Post('run')
  @RequierePlan('reportesAvanzados')
  @ApiOperation({ summary: 'Ejecuta un reporte dinámico con campos, filtros, orden y paginación' })
  ejecutar(@Body() request: ReportRunRequestDto): Promise<ReportResultDto> {
    return this.reportsService.ejecutar(request);
  }

  @Post('generativo')
  @RequierePlan('reportesAvanzados')
  @ApiOperation({ summary: 'Interpreta un pedido en lenguaje natural (voz o texto) y genera el reporte' })
  generativo(@Body() body: ReporteGenerativoRequestDto): Promise<ReporteGenerativoResponseDto> {
    return this.reportsService.generativo(body.prompt);
  }

  @Get('predefinidos')
  @ApiOperation({ summary: 'Catálogo de reportes predefinidos listos para ejecutar con un clic' })
  predefinidos(): ReportePredefinidoDto[] {
    return this.reportsService.predefinidos();
  }

  @Post('predefinidos/:codigo/ejecutar')
  @ApiOperation({ summary: 'Ejecuta un reporte predefinido (resuelve su rango de fechas al momento) y devuelve una pagina del resultado' })
  ejecutarPredefinido(@Param('codigo') codigo: string, @Query() query: PaginaPredefinidoQueryDto): Promise<ReportePredefinidoEjecutadoDto> {
    return this.reportsService.ejecutarPredefinido(codigo, query.offset ?? 0);
  }

  @Post('predefinidos/:codigo/exportar')
  @ApiOperation({ summary: 'Descarga un reporte predefinido en pdf, excel o html (configuracion armada en el servidor)' })
  async exportarPredefinido(@Param('codigo') codigo: string, @Query() query: ExportQueryDto, @Res() res: Response): Promise<void> {
    this.enviarArchivo(res, await this.reportsService.exportarPredefinido(query.format, codigo));
  }

  /** Acepta cualquier configuracion: es el Constructor por otra puerta, asi que exige el mismo plan. */
  @Post('export')
  @RequierePlan('reportesAvanzados')
  @ApiOperation({ summary: 'Descarga un reporte del Constructor o del generativo en pdf, excel o html' })
  async exportar(
    @Query() query: ExportQueryDto,
    @Body() request: ReportRunRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    this.enviarArchivo(res, await this.reportsService.exportar(query.format, request));
  }

  /** El resumen que acompaña al PDF y al Excel (indicadores, gráficos y análisis), sobre todos los datos del reporte. */
  @Post('resumen')
  @RequierePlan('reportesAvanzados')
  @ApiOperation({ summary: 'Indicadores, gráficos y análisis comercial de un reporte (los mismos que van en el PDF y el Excel)' })
  resumen(@Body() request: ReportRunRequestDto): Promise<ResumenReporte> {
    return this.resumenService.resumir(request);
  }

  /** Respuesta binaria, sin el envoltorio { data, timestamp }. */
  private enviarArchivo(res: Response, archivo: ArchivoReporte): void {
    res.set({
      'Content-Type': archivo.contentType,
      'Content-Disposition': `attachment; filename="${archivo.nombreArchivo}"`,
      'Content-Length': String(archivo.buffer.length),
    });
    res.send(archivo.buffer);
  }

  @Get('templates')
  @RequierePlan('reportesAvanzados')
  @ApiOperation({ summary: 'Lista las plantillas guardadas del usuario actual' })
  listarPlantillas(@CurrentUser() usuario: ActiveUser): Promise<ReportTemplateDto[]> {
    return this.reportsService.listarPlantillas(usuario.sub);
  }

  @Post('templates')
  @RequierePlan('reportesAvanzados')
  @ApiOperation({ summary: 'Guarda la configuración actual como plantilla' })
  crearPlantilla(
    @Body() body: CreateReportTemplateDto,
    @CurrentUser() usuario: ActiveUser,
  ): Promise<ReportTemplateDto> {
    return this.reportsService.crearPlantilla(usuario.sub, body);
  }

  @Put('templates/:id')
  @RequierePlan('reportesAvanzados')
  @ApiOperation({ summary: 'Actualiza una plantilla propia del usuario' })
  actualizarPlantilla(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateReportTemplateDto,
    @CurrentUser() usuario: ActiveUser,
  ): Promise<ReportTemplateDto> {
    return this.reportsService.actualizarPlantilla(usuario.sub, id, body);
  }

  @Delete('templates/:id')
  @RequierePlan('reportesAvanzados')
  @ApiOperation({ summary: 'Elimina una plantilla propia del usuario' })
  eliminarPlantilla(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: ActiveUser,
  ): Promise<void> {
    return this.reportsService.eliminarPlantilla(usuario.sub, id);
  }
}
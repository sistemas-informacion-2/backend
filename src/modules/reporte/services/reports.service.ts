import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  CreateReportTemplateDto,
  FormatoExportacion,
  ReporteGenerativoResponseDto,
  ReportePredefinidoDto,
  ReportePredefinidoEjecutadoDto,
  ReportResultDto,
  ReportRunRequestDto,
  ReportTemplateDto,
  ReportTypeDefinitionDto,
  UpdateReportTemplateDto,
} from '../dto/reporte-builder.dto.js';
import { buscarReportePredefinido, REPORTES_PREDEFINIDOS, type RangoPredefinido, type ReportePredefinido } from '../catalog/reportes-predefinidos.constants.js';
import { ReportePlantilla } from '../entities/reporte-plantilla.entity.js';
import { ReportePlantillaRepository } from '../repositories/reporte-plantilla.repository.js';
import { exportarReporte, type ArchivoReporte } from '../utils/reporte-exportador.util.js';
import { GeminiReporteService } from './gemini-reporte.service.js';
import { ReportBuilderService } from './report-builder.service.js';
import { ReporteNlpService, type InterpretacionPrompt } from './reporte-nlp.service.js';

/**
 * Orquestador del Report Builder (CU18): ejecución, exportación, plantillas
 * y los reportes generativos por voz/lenguaje natural.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly builder: ReportBuilderService,
    private readonly nlp: ReporteNlpService,
    private readonly gemini: GeminiReporteService,
    private readonly plantillaRepo: ReportePlantillaRepository,
  ) {}

  catalogo(): ReportTypeDefinitionDto[] {
    return this.builder.catalogo();
  }

  ejecutar(request: ReportRunRequestDto): Promise<ReportResultDto> {
    return this.builder.ejecutar(request);
  }

  async generativo(prompt: string): Promise<ReporteGenerativoResponseDto> {
    const { interpretado, fuente } = await this.interpretarConIA(prompt);
    const result = await this.builder.ejecutar(interpretado.request);
    return { prompt, interpretacion: interpretado.interpretacion, request: interpretado.request, result, fuente };
  }

  /**
   * Intenta primero con Gemini (entiende lenguaje natural de verdad: sinónimos,
   * modismos, pedidos compuestos). Si no hay API key configurada, o la llamada
   * falla (cuota agotada, sin internet, respuesta inválida), cae sin romper al
   * traductor por palabras clave (ReporteNlpService) — el reporte generativo
   * sigue funcionando, solo que con una interpretación más literal.
   */
  private async interpretarConIA(prompt: string): Promise<{ interpretado: InterpretacionPrompt; fuente: 'IA' | 'REGEX' }> {
    if (this.gemini.disponible) {
      try {
        return { interpretado: await this.gemini.interpretar(prompt), fuente: 'IA' };
      } catch (error) {
        this.logger.warn(`Gemini fallo interpretando el reporte generativo, se usa el traductor por palabras clave: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return { interpretado: await this.nlp.interpretar(prompt), fuente: 'REGEX' };
  }

  /** Catálogo de reportes predefinidos (CU18): solo metadatos, sin ejecutar nada. */
  predefinidos(): ReportePredefinidoDto[] {
    return REPORTES_PREDEFINIDOS.map(({ codigo, nombre, descripcion, categoria }) => ({ codigo, nombre, descripcion, categoria }));
  }

  async ejecutarPredefinido(codigo: string): Promise<ReportePredefinidoEjecutadoDto> {
    const definicion = buscarReportePredefinido(codigo);
    if (!definicion) throw new NotFoundException(`No existe el reporte predefinido "${codigo}"`);

    const request = this.resolverRequestPredefinido(definicion);
    const result = await this.builder.ejecutar(request);
    return { codigo: definicion.codigo, nombre: definicion.nombre, request, result };
  }

  /** Arma el ReportRunRequestDto real a partir de la definicion estatica, resolviendo el rango de fechas al momento de ejecutar (nunca se guarda una fecha fija en el catalogo). */
  private resolverRequestPredefinido(definicion: ReportePredefinido): ReportRunRequestDto {
    const { desde, hasta } = this.resolverRango(definicion.rango);
    return {
      reportType: definicion.reportType,
      selectedFields: [...definicion.selectedFields],
      filters: definicion.filters ? [...definicion.filters] : [],
      sort: definicion.sort,
      dateFrom: desde,
      dateTo: hasta,
      limit: definicion.limit ?? 50,
      offset: 0,
    };
  }

  private resolverRango(rango: RangoPredefinido): { desde?: string; hasta?: string } {
    const iso = (fecha: Date) => fecha.toISOString().slice(0, 10);
    const hoy = new Date();
    switch (rango.tipo) {
      case 'HOY':
        return { desde: iso(hoy), hasta: iso(hoy) };
      case 'ULTIMOS_N_DIAS': {
        const desde = new Date(hoy);
        desde.setDate(desde.getDate() - (rango.dias - 1));
        return { desde: iso(desde), hasta: iso(hoy) };
      }
      case 'MES_ACTUAL': {
        const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        return { desde: iso(inicio), hasta: iso(hoy) };
      }
      case 'NINGUNO':
      default:
        return {};
    }
  }

  async exportar(formato: FormatoExportacion, request: ReportRunRequestDto): Promise<ArchivoReporte> {
    const resultado = await this.builder.ejecutar(request);
    return exportarReporte(formato, this.builder.nombreTipo(request.reportType), resultado);
  }

  async listarPlantillas(idUsuario: number): Promise<ReportTemplateDto[]> {
    const plantillas = await this.plantillaRepo.listarPorUsuario(idUsuario);
    return plantillas.map((plantilla) => this.aDto(plantilla));
  }

  async crearPlantilla(idUsuario: number, datos: CreateReportTemplateDto): Promise<ReportTemplateDto> {
    const plantilla = await this.plantillaRepo.crear({
      idUsuario,
      nombre: datos.nombre,
      config: datos.config,
    });
    return this.aDto(plantilla);
  }

  async actualizarPlantilla(idUsuario: number, id: number, cambios: UpdateReportTemplateDto): Promise<ReportTemplateDto> {
    const plantilla = await this.plantillaRepo.buscarPropia(id, idUsuario);
    const actualizada = await this.plantillaRepo.actualizar(plantilla, {
      ...(cambios.nombre !== undefined ? { nombre: cambios.nombre } : {}),
      ...(cambios.config !== undefined ? { config: cambios.config } : {}),
    });
    return this.aDto(actualizada);
  }

  async eliminarPlantilla(idUsuario: number, id: number): Promise<void> {
    const plantilla = await this.plantillaRepo.buscarPropia(id, idUsuario);
    await this.plantillaRepo.eliminar(plantilla.id);
  }

  private aDto(plantilla: ReportePlantilla): ReportTemplateDto {
    return {
      id: plantilla.id,
      idUsuario: plantilla.idUsuario,
      nombre: plantilla.nombre,
      config: plantilla.config,
      fechaCreacion: plantilla.fechaCreacion,
      fechaActualizacion: plantilla.fechaActualizacion,
    };
  }
}
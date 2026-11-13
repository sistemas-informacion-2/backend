import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { fechaLocal, inicioDeMes, sumarDias } from '../../../common/utils/fecha.util.js';
import {
  LIMITE_REPORTE_MAXIMO,
  type CreateReportTemplateDto,
  type FormatoExportacion,
  type ReporteGenerativoResponseDto,
  type ReportePredefinidoDto,
  type ReportePredefinidoEjecutadoDto,
  type ReportResultDto,
  type ReportRunRequestDto,
  type ReportTemplateDto,
  type ReportTypeDefinitionDto,
  type UpdateReportTemplateDto,
} from '../dto/reporte-builder.dto.js';
import { buscarReportePredefinido, REPORTES_PREDEFINIDOS, type RangoPredefinido, type ReportePredefinido } from '../catalog/reportes-predefinidos.constants.js';
import { ReportePlantilla } from '../entities/reporte-plantilla.entity.js';
import { ReportePlantillaRepository } from '../repositories/reporte-plantilla.repository.js';
import { exportarReporte, type ArchivoReporte } from '../utils/reporte-exportador.util.js';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';
import { CuotaGenerativoService } from './cuota-generativo.service.js';
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
    private readonly cuota: CuotaGenerativoService,
    private readonly tenant: TenantContext,
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
    let sinCuota = false;
    if (this.gemini.disponible) {
      // La cuota se descuenta solo cuando de verdad se llama a Gemini.
      sinCuota = !this.cuota.consumir(this.tenant.empresaId());
      if (!sinCuota) {
        try {
          const interpretado = await this.gemini.interpretar(prompt);
          // Red de seguridad: una configuracion que el constructor rechazaria (400) cae al traductor, no al usuario.
          this.builder.validar(interpretado.request);
          return { interpretado, fuente: 'IA' };
        } catch (error) {
          this.logger.warn(`Gemini fallo interpretando el reporte generativo, se usa el traductor por palabras clave: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    const interpretado = await this.nlp.interpretar(prompt);
    if (sinCuota) {
      interpretado.interpretacion = `${interpretado.interpretacion} · Tu tienda alcanzó el límite diario de reportes con IA: este se armó con el traductor por palabras clave. Mañana vuelve a usarse la IA.`;
    }
    return { interpretado, fuente: 'REGEX' };
  }

  /** Catálogo de reportes predefinidos (CU18): solo metadatos, sin ejecutar nada. */
  predefinidos(): ReportePredefinidoDto[] {
    return REPORTES_PREDEFINIDOS.map(({ codigo, nombre, descripcion, categoria }) => ({ codigo, nombre, descripcion, categoria }));
  }

  async ejecutarPredefinido(codigo: string, offset = 0): Promise<ReportePredefinidoEjecutadoDto> {
    const definicion = this.predefinido(codigo);
    const request = { ...this.resolverRequestPredefinido(definicion), offset };
    const result = await this.builder.ejecutar(request);
    return { codigo: definicion.codigo, nombre: definicion.nombre, request, result };
  }

  /**
   * Exporta un predefinido con la configuracion que arma el servidor, no con una que mande el cliente. Por eso esta en
   * todos los planes, mientras que /reports/export (cualquier configuracion) exige reportes avanzados.
   */
  async exportarPredefinido(formato: FormatoExportacion, codigo: string): Promise<ArchivoReporte> {
    const definicion = this.predefinido(codigo);
    const resultado = await this.builder.ejecutar({ ...this.resolverRequestPredefinido(definicion), limit: LIMITE_REPORTE_MAXIMO, offset: 0 });
    return exportarReporte(formato, definicion.nombre, resultado);
  }

  private predefinido(codigo: string): ReportePredefinido {
    const definicion = buscarReportePredefinido(codigo);
    if (!definicion) throw new NotFoundException(`No existe el reporte predefinido "${codigo}"`);
    return definicion;
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
    // Fechas de calendario en Bolivia (ver fecha.util).
    const hoy = fechaLocal();
    switch (rango.tipo) {
      case 'HOY':
        return { desde: hoy, hasta: hoy };
      case 'ULTIMOS_N_DIAS':
        return { desde: sumarDias(hoy, -(rango.dias - 1)), hasta: hoy };
      case 'MES_ACTUAL':
        return { desde: inicioDeMes(hoy), hasta: hoy };
      case 'NINGUNO':
      default:
        return {};
    }
  }

  /**
   * Exporta el reporte completo, no la pagina que se esta viendo: se ignoran el limit y el offset de la pantalla y se
   * piden hasta LIMITE_REPORTE_MAXIMO filas. Si el reporte tiene mas, el archivo lo avisa (ver reporte-exportador).
   */
  async exportar(formato: FormatoExportacion, request: ReportRunRequestDto): Promise<ArchivoReporte> {
    const resultado = await this.builder.ejecutar({ ...request, limit: LIMITE_REPORTE_MAXIMO, offset: 0 });
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
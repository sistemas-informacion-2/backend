import { Injectable } from '@nestjs/common';
import type {
  CreateReportTemplateDto,
  FormatoExportacion,
  ReporteGenerativoResponseDto,
  ReportResultDto,
  ReportRunRequestDto,
  ReportTemplateDto,
  ReportTypeDefinitionDto,
  UpdateReportTemplateDto,
} from '../dto/reporte-builder.dto.js';
import { ReportePlantilla } from '../entities/reporte-plantilla.entity.js';
import { ReportePlantillaRepository } from '../repositories/reporte-plantilla.repository.js';
import { exportarReporte, type ArchivoReporte } from '../utils/reporte-exportador.util.js';
import { ReportBuilderService } from './report-builder.service.js';
import { ReporteNlpService } from './reporte-nlp.service.js';

/**
 * Orquestador del Report Builder (CU18): ejecución, exportación, plantillas
 * y los reportes generativos por voz/lenguaje natural.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly builder: ReportBuilderService,
    private readonly nlp: ReporteNlpService,
    private readonly plantillaRepo: ReportePlantillaRepository,
  ) {}

  catalogo(): ReportTypeDefinitionDto[] {
    return this.builder.catalogo();
  }

  ejecutar(request: ReportRunRequestDto): Promise<ReportResultDto> {
    return this.builder.ejecutar(request);
  }

  async generativo(prompt: string): Promise<ReporteGenerativoResponseDto> {
    const { request, interpretacion } = await this.nlp.interpretar(prompt);
    const result = await this.builder.ejecutar(request);
    return { prompt, interpretacion, request, result };
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
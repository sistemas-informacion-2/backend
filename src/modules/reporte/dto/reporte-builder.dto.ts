import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ArrayNotEmpty,
  ValidateNested,
} from 'class-validator';
import type { CategoriaCampo, OperadorFiltro, TipoCampo } from '../catalog/reporte-catalog.constants.js';

export const FORMATOS_EXPORTACION = ['pdf', 'excel', 'html'] as const;
export type FormatoExportacion = (typeof FORMATOS_EXPORTACION)[number];

export class FieldDefinitionDto {
  name: string;
  label: string;
  categoria: CategoriaCampo;
  tipo: TipoCampo;
  permiteFiltro: boolean;
  permiteOrden: boolean;
  operadores: OperadorFiltro[];
}

export class ReportTypeDefinitionDto {
  id: string;
  nombre: string;
  descripcion: string;
  campos: FieldDefinitionDto[];
}

export class ReportFilterDto {
  @IsString()
  campo: string;

  @IsString()
  @IsIn(['eq', 'ne', 'contains', 'startsWith', 'endsWith', 'gt', 'gte', 'lt', 'lte'])
  operador: OperadorFiltro;

  /** El tipo concreto (string | number | boolean) se valida según el campo en el service. */
  @IsDefined()
  valor: string | number | boolean;
}

export class ReportSortDto {
  @IsString()
  campo: string;

  @IsIn(['asc', 'desc'])
  direccion: 'asc' | 'desc';
}

/** Restricción compartida: un reporte nunca devuelve más de 500 filas. */
export const LIMITE_REPORTE_MAXIMO = 500;

export class ReportRunRequestDto {
  @IsString()
  reportType: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  selectedFields: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportFilterDto)
  filters?: ReportFilterDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ReportSortDto)
  sort?: ReportSortDto;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateFrom debe tener formato AAAA-MM-DD' })
  dateFrom?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateTo debe tener formato AAAA-MM-DD' })
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIMITE_REPORTE_MAXIMO)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class ReportResultDto {
  /** Nombres técnicos de las columnas (en orden). */
  columns: string[];
  /** Etiquetas legibles de las columnas. */
  columnLabels: string[];
  rows: Array<Array<string | number | boolean>>;
  total: number;
}

export class ReporteGenerativoRequestDto {
  @IsString()
  prompt: string;
}

export class ReporteGenerativoResponseDto {
  /** Prompt original recibido (lo que el usuario dictó por voz). */
  prompt: string;
  /** Explicación en lenguaje natural de cómo se interpretó el pedido. */
  interpretacion: string;
  /** La config que finalmente se ejecutó. */
  request: ReportRunRequestDto;
  result: ReportResultDto;
}

export class ExportQueryDto {
  @IsIn(FORMATOS_EXPORTACION)
  format: FormatoExportacion;
}

export class ReportTemplateDto {
  id: number;
  idUsuario: number;
  nombre: string;
  config: ReportRunRequestDto;
  fechaCreacion: Date;
  fechaActualizacion: Date;
}

export class BaseReportTemplateDto {
  @IsString()
  nombre: string;

  @ValidateNested()
  @Type(() => ReportRunRequestDto)
  config: ReportRunRequestDto;
}

export class CreateReportTemplateDto extends BaseReportTemplateDto {
  @IsNumber()
  @IsOptional()
  idUsuario?: number;
}

export class UpdateReportTemplateDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReportRunRequestDto)
  config?: ReportRunRequestDto;
}

export class ReportTemplateParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id: number;
}
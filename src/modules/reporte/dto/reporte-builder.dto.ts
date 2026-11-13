import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
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
  /** Importe en bolivianos: se muestra como "Bs.". */
  moneda: boolean;
  operadores: OperadorFiltro[];
}

/** Como se muestra una columna del resultado. */
export type FormatoColumna = 'TEXTO' | 'NUMERO' | 'MONEDA' | 'FECHA' | 'BOOLEANO';

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

  /** Cómo se combinan los filtros entre sí: todos (AND, por defecto) o alguno (OR). No afecta el rango de fechas, que siempre es AND. */
  @IsOptional()
  @IsString()
  @IsIn(['AND', 'OR'])
  matchType?: 'AND' | 'OR';

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
  /** Formato de cada columna (en el mismo orden): dinero, número, fecha, texto o verdadero/falso. */
  columnFormats: FormatoColumna[];
  rows: Array<Array<string | number | boolean>>;
  total: number;
}

/** Largo maximo del pedido al generativo: alcanza para un dictado largo y evita mandarle a Gemini textos enormes. */
export const LARGO_MAXIMO_PEDIDO = 1000;
/** Largo de la columna reporte_plantilla.nombre. */
export const LARGO_MAXIMO_NOMBRE_PLANTILLA = 100;

export class ReporteGenerativoRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Escribe o dicta qué reporte necesitas' })
  @MaxLength(LARGO_MAXIMO_PEDIDO, { message: `El pedido no puede pasar de ${LARGO_MAXIMO_PEDIDO} caracteres` })
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
  /** Qué interprete respondió esta vez: IA (Gemini) o REGEX (el traductor por palabras clave, usado si Gemini no está configurado o falló). */
  fuente: 'IA' | 'REGEX';
}

/** Pagina de un reporte predefinido: desde que fila mostrar (de a 50). */
export class PaginaPredefinidoQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
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

/** Entrada del catálogo de reportes predefinidos (sin ejecutar todavía). */
export class ReportePredefinidoDto {
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: string;
}

/** Resultado de ejecutar un reporte predefinido: igual forma que el generativo, sin el prompt ni la interpretación. */
export class ReportePredefinidoEjecutadoDto {
  codigo: string;
  nombre: string;
  request: ReportRunRequestDto;
  result: ReportResultDto;
}

export class BaseReportTemplateDto {
  @IsString()
  @IsNotEmpty({ message: 'La plantilla necesita un nombre' })
  @MaxLength(LARGO_MAXIMO_NOMBRE_PLANTILLA, { message: `El nombre de la plantilla no puede pasar de ${LARGO_MAXIMO_NOMBRE_PLANTILLA} caracteres` })
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
  @IsNotEmpty({ message: 'La plantilla necesita un nombre' })
  @MaxLength(LARGO_MAXIMO_NOMBRE_PLANTILLA, { message: `El nombre de la plantilla no puede pasar de ${LARGO_MAXIMO_NOMBRE_PLANTILLA} caracteres` })
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
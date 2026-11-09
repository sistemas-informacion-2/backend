import { Type } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import type { Fila, ResultadoHerramienta } from '../herramientas/herramienta.js';
import type { GraficoDto } from '../herramientas/registro-herramientas.service.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class ModelosQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sucursal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  categoria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  producto?: string;

  @IsOptional()
  @IsIn(['ALTO', 'MEDIO', 'BAJO'])
  nivel?: string;

  @IsOptional()
  @IsIn(['MENSUAL', 'SEMANAL'])
  frecuencia?: 'MENSUAL' | 'SEMANAL';

  @IsOptional()
  @Matches(FECHA)
  desde?: string;

  @IsOptional()
  @Matches(FECHA)
  hasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;
}

export class GuardarGraficoDto {
  @IsString()
  @MaxLength(60)
  herramienta: string;

  @IsObject()
  parametros: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  titulo?: string;
}

export interface ModeloResumenDto {
  clave: string;
  titulo: string;
  tipo: 'SUPERVISADO' | 'NO_SUPERVISADO' | 'PRESCRIPTIVO';
  tecnica: string;
  metricas: Record<string, unknown> | null;
}

export interface ResumenModelosDto {
  ultimaEjecucion: { estado: string; inicio: Date; fin: Date | null; error: string | null } | null;
  modelos: ModeloResumenDto[];
}

export interface PronosticoModeloDto {
  frecuencia: 'MENSUAL' | 'SEMANAL';
  historia: Array<{ periodo: string; valor: number }>;
  futuro: Fila[];
  disponible: boolean;
  modelo: string | null;
  nota: string | null;
  grafico: GraficoDto | null;
}

export interface GraficoGuardadoDto {
  id: number;
  titulo: string;
  herramienta: string;
  parametros: Record<string, unknown>;
  fechaCreacion: Date;
}

export interface DatosGraficoDto extends GraficoGuardadoDto {
  grafico: GraficoDto | null;
  resultado: ResultadoHerramienta;
}

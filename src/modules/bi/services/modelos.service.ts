import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';
import { fechaLocal } from '../../../common/utils/fecha.util.js';
import type { ModeloResumenDto, PronosticoModeloDto, ResumenModelosDto } from '../dto/modelos.dto.js';
import type { ResultadoHerramienta } from '../herramientas/herramienta.js';
import { RegistroHerramientas, type EjecucionHerramienta } from '../herramientas/registro-herramientas.service.js';

const MODELOS: Array<Omit<ModeloResumenDto, 'metricas'>> = [
  { clave: 'pronostico', titulo: 'Pronóstico de ventas', tipo: 'SUPERVISADO', tecnica: 'Holt, Holt-Winters o estacional con tendencia: gana el de menor error' },
  { clave: 'abandono', titulo: 'Clientes en riesgo', tipo: 'SUPERVISADO', tecnica: 'Random Forest o regresión logística: gana el de mayor AUC' },
  { clave: 'segmentacion', titulo: 'Segmentos de clientes', tipo: 'NO_SUPERVISADO', tecnica: 'K-means sobre recencia, frecuencia y monto' },
  { clave: 'canasta', titulo: 'Canasta de mercado', tipo: 'NO_SUPERVISADO', tecnica: 'Reglas de asociación con Apriori' },
  { clave: 'anomalias', titulo: 'Anomalías', tipo: 'NO_SUPERVISADO', tecnica: 'Descomposición STL e Isolation Forest sobre tickets presenciales' },
  { clave: 'reposicion', titulo: 'Sugerencia de compra', tipo: 'PRESCRIPTIVO', tecnica: 'Pronóstico de demanda menos stock actual, con stock de seguridad' },
];

const MESES_DE_HISTORIA = 24;
const SEMANAS_DE_HISTORIA = 52;

function texto(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** Periodos completos hacia atras: no incluye el mes o la semana en curso. */
export function rangoDeHistoria(hoy: string, frecuencia: 'MENSUAL' | 'SEMANAL'): { desde: string; hasta: string } {
  const [anio, mes, dia] = hoy.split('-').map(Number);
  if (frecuencia === 'MENSUAL') {
    return { desde: texto(new Date(Date.UTC(anio, mes - 1 - MESES_DE_HISTORIA, 1))), hasta: texto(new Date(Date.UTC(anio, mes - 1, 0))) };
  }
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  const lunes = new Date(fecha.getTime() - ((fecha.getUTCDay() + 6) % 7) * 86_400_000);
  return { desde: texto(new Date(lunes.getTime() - SEMANAS_DE_HISTORIA * 7 * 86_400_000)), hasta: texto(new Date(lunes.getTime() - 86_400_000)) };
}

/** Datos de la pantalla Modelos. Reutiliza las herramientas del agente: mismos filtros y misma seguridad, sin Gemini. */
@Injectable()
export class ModelosService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly registro: RegistroHerramientas,
    private readonly tenant: TenantContext,
  ) {}

  async resumen(): Promise<ResumenModelosDto> {
    const [ultima] = await this.dataSource.query<Array<{ estado: string; inicio: Date; fin: Date | null; error: string | null; metricas: Record<string, Record<string, unknown>> | null }>>(
      `SELECT estado, inicio, fin, error, metricas FROM dw.ml_ejecucion WHERE id_empresa = $1 ORDER BY id DESC LIMIT 1`,
      [this.tenant.empresaId()],
    );
    return {
      ultimaEjecucion: ultima ? { estado: ultima.estado, inicio: ultima.inicio, fin: ultima.fin, error: ultima.error } : null,
      modelos: MODELOS.map((modelo) => ({ ...modelo, metricas: ultima?.metricas?.[modelo.clave] ?? null })),
    };
  }

  async pronostico(filtros: { frecuencia?: 'MENSUAL' | 'SEMANAL'; sucursal?: string; categoria?: string }): Promise<PronosticoModeloDto> {
    const frecuencia = filtros.frecuencia ?? 'MENSUAL';
    const alcance = this.sinVacios({ sucursal: filtros.sucursal, categoria: filtros.categoria });
    const futuro = await this.ejecutar('pronosticar_ventas', { frecuencia, ...alcance });
    const resultadoFuturo = futuro.resultado as ResultadoHerramienta;

    const { desde, hasta } = rangoDeHistoria(fechaLocal(), frecuencia);
    const pasado = await this.ejecutar('ventas_por_periodo', { desde, hasta, agrupar_por: frecuencia === 'MENSUAL' ? 'mes' : 'semana', ...alcance });
    const historia = (pasado.resultado as ResultadoHerramienta).filas.map((fila) => ({
      periodo: frecuencia === 'MENSUAL' ? `${String(fila.grupo)}-01` : String(fila.grupo),
      valor: Number(fila.ventas),
    }));

    return {
      frecuencia,
      historia,
      futuro: resultadoFuturo.filas,
      disponible: resultadoFuturo.disponible !== false && resultadoFuturo.filas.length > 0,
      modelo: typeof resultadoFuturo.filas[0]?.modelo === 'string' ? resultadoFuturo.filas[0].modelo : null,
      nota: resultadoFuturo.nota ?? null,
      grafico: futuro.grafico,
    };
  }

  /** Resultado de una herramienta, con las columnas privadas: esta pantalla exige estar autenticado con permiso. */
  async consultar(herramienta: string, argumentos: Record<string, unknown>): Promise<ResultadoHerramienta> {
    return (await this.ejecutar(herramienta, this.sinVacios(argumentos))).resultado as ResultadoHerramienta;
  }

  private async ejecutar(herramienta: string, argumentos: Record<string, unknown>): Promise<EjecucionHerramienta> {
    const ejecucion = await this.registro.ejecutar(herramienta, argumentos, this.tenant.empresaId(), fechaLocal());
    if (!ejecucion.ok) throw new BadRequestException((ejecucion.resultado as { error: string }).error);
    return ejecucion;
  }

  private sinVacios(argumentos: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(argumentos).filter(([, valor]) => valor !== undefined && valor !== ''));
  }
}

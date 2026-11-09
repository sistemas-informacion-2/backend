import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';
import type { AppConfig } from '../../../config/configuration.js';

export type ModoIa = 'VERTEX' | 'API_KEY' | 'SIN_CONFIGURAR';

/** Tiempo maximo de una llamada a Gemini; el agente hace varias por pregunta. */
const TIMEOUT_MS = 30_000;

/**
 * Cliente de Gemini del BI. El mismo codigo atiende por Vertex AI (Google Cloud: proyecto + region, credenciales por
 * ADC/GOOGLE_APPLICATION_CREDENTIALS) o por Google AI Studio (GEMINI_API_KEY), segun el .env:
 *
 * - BI_IA_PROVEEDOR=vertex  -> Vertex AI (exige GOOGLE_CLOUD_PROJECT).
 * - BI_IA_PROVEEDOR=api-key -> AI Studio (exige GEMINI_API_KEY).
 * - auto (por defecto)      -> Vertex si hay GOOGLE_CLOUD_PROJECT; si no, la API key.
 *
 * Las credenciales nunca pasan por aqui ni se registran: el SDK las lee del entorno.
 */
@Injectable()
export class GeminiBiClient {
  private readonly logger = new Logger(GeminiBiClient.name);
  private cliente: GoogleGenAI | null = null;
  private readonly bi: AppConfig['bi'];
  private readonly apiKey: string;
  private readonly modeloPorDefecto: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.bi = config.get('bi', { infer: true });
    this.apiKey = config.get('gemini.apiKey', { infer: true });
    this.modeloPorDefecto = this.bi.modelo || config.get('gemini.model', { infer: true });
  }

  modo(): ModoIa {
    const hayVertex = this.bi.vertexProyecto !== '';
    const hayApiKey = this.apiKey !== '';
    if (this.bi.iaProveedor === 'vertex') return hayVertex ? 'VERTEX' : 'SIN_CONFIGURAR';
    if (this.bi.iaProveedor === 'api-key') return hayApiKey ? 'API_KEY' : 'SIN_CONFIGURAR';
    return hayVertex ? 'VERTEX' : hayApiKey ? 'API_KEY' : 'SIN_CONFIGURAR';
  }

  modelo(): string {
    return this.modeloPorDefecto;
  }

  /** Una llamada a generateContent con el modelo del BI (salvo que la peticion traiga otro). */
  async generar(peticion: Omit<GenerateContentParameters, 'model'> & { model?: string }): Promise<GenerateContentResponse> {
    return this.obtenerCliente().models.generateContent({ ...peticion, model: peticion.model ?? this.modeloPorDefecto });
  }

  private obtenerCliente(): GoogleGenAI {
    if (this.cliente) return this.cliente;
    const modo = this.modo();
    if (modo === 'SIN_CONFIGURAR') {
      throw new ServiceUnavailableException(
        'El asistente del BI no está configurado: define GEMINI_API_KEY o, para Vertex AI, GOOGLE_CLOUD_PROJECT y GOOGLE_APPLICATION_CREDENTIALS',
      );
    }
    this.cliente =
      modo === 'VERTEX'
        ? new GoogleGenAI({ vertexai: true, project: this.bi.vertexProyecto, location: this.bi.vertexRegion, httpOptions: { timeout: TIMEOUT_MS } })
        : new GoogleGenAI({ apiKey: this.apiKey, httpOptions: { timeout: TIMEOUT_MS } });
    this.logger.log(`Asistente del BI con ${modo === 'VERTEX' ? `Vertex AI (${this.bi.vertexProyecto}, ${this.bi.vertexRegion})` : 'Google AI Studio'}, modelo ${this.modeloPorDefecto}`);
    return this.cliente;
  }
}

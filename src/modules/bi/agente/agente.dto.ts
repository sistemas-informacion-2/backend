import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { HerramientaUsada } from '../entities/bi-mensaje.entity.js';
import type { EjecucionHerramienta } from '../herramientas/registro-herramientas.service.js';

export class PreguntarDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  pregunta: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  idConversacion?: number;
}

export interface RespuestaAgenteDto {
  idConversacion: number;
  texto: string;
  /** Lo que se consulto, con los datos completos, para dibujar graficos y mostrar "Como se calculo". */
  herramientas: Array<Pick<EjecucionHerramienta, 'nombre' | 'parametros' | 'ok' | 'resultado' | 'grafico'>>;
  tokens: { entrada: number; salida: number };
}

export interface ConversacionResumenDto {
  id: number;
  titulo: string;
  fechaCreacion: Date;
  fechaActualizacion: Date;
}

export interface MensajeDto {
  id: number;
  rol: 'USUARIO' | 'ASISTENTE';
  contenido: string;
  herramientas: HerramientaUsada[] | null;
  fecha: Date;
}

export interface ConversacionDetalleDto extends ConversacionResumenDto {
  mensajes: MensajeDto[];
}

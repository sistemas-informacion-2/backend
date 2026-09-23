import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encrypt } from '../../../common/utils/crypto.util.js';
import type { AppConfig } from '../../../config/configuration.js';
import { PasarelaRepository } from '../repositories/pasarela.repository.js';
import { toPasarelaResponseDto } from '../mappers/pasarela.mapper.js';
import type { IntegracionPago } from '../entities/pasarela-pago.entity.js';
import type { CrearPasarelaDto } from '../dto/crear-pasarela.dto.js';
import type { ActualizarPasarelaDto } from '../dto/actualizar-pasarela.dto.js';
import type { ActualizarDisponibilidadPasarelaDto } from '../dto/actualizar-disponibilidad-pasarela.dto.js';
import type { PasarelasQueryDto } from '../dto/pasarelas-query.dto.js';
import type { PasarelaResponseDto } from '../dto/pasarela-response.dto.js';

@Injectable()
export class PasarelasService {
  constructor(
    private readonly pasarelaRepo: PasarelaRepository,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async listar(query: PasarelasQueryDto): Promise<PasarelaResponseDto[]> {
    const pasarelas = await this.pasarelaRepo.findWithFilters(query);
    return pasarelas.map(toPasarelaResponseDto);
  }

  async listarPresencial(): Promise<PasarelaResponseDto[]> {
    const pasarelas = await this.pasarelaRepo.findPresencial();
    return pasarelas.map(toPasarelaResponseDto);
  }

  async listarLinea(): Promise<PasarelaResponseDto[]> {
    const pasarelas = await this.pasarelaRepo.findLinea();
    return pasarelas.map(toPasarelaResponseDto);
  }

  async obtener(id: number): Promise<PasarelaResponseDto> {
    const pasarela = await this.pasarelaRepo.findById(id);
    if (!pasarela) throw new NotFoundException('Metodo de pago no encontrado');
    return toPasarelaResponseDto(pasarela);
  }

  async crear(dto: CrearPasarelaDto): Promise<PasarelaResponseDto> {
    const codigo = dto.codigo.trim().toUpperCase();
    await this.validarCodigoDisponible(codigo);

    const integracion = dto.integracion ?? 'NINGUNA';
    const apiKeyEncriptada = this.cifrarCredenciales(dto.apiKey, dto.apiSecret);
    const disponiblePresencial = dto.disponiblePresencial ?? false;
    const disponibleLinea = dto.disponibleLinea ?? false;
    this.validarCanalesHabilitados(integracion, apiKeyEncriptada, disponiblePresencial, disponibleLinea, 'badRequest');

    const pasarela = this.pasarelaRepo.create({
      codigo,
      metodo: dto.metodo.trim(),
      descripcion: dto.descripcion?.trim() || null,
      integracion,
      apiKeyEncriptada,
      comisionPorcentaje: (dto.comisionPorcentaje ?? 0).toFixed(2),
      disponiblePresencial,
      disponibleLinea,
    });
    await this.pasarelaRepo.save(pasarela);

    return toPasarelaResponseDto(pasarela);
  }

  async actualizar(id: number, dto: ActualizarPasarelaDto): Promise<PasarelaResponseDto> {
    const pasarela = await this.pasarelaRepo.findById(id);
    if (!pasarela) throw new NotFoundException('Metodo de pago no encontrado');

    const integracion = dto.integracion ?? pasarela.integracion;
    const credencialesNuevas = this.cifrarCredenciales(dto.apiKey, dto.apiSecret);
    const apiKeyEncriptada = credencialesNuevas ?? pasarela.apiKeyEncriptada;
    const disponiblePresencial = dto.disponiblePresencial ?? pasarela.disponiblePresencial;
    const disponibleLinea = dto.disponibleLinea ?? pasarela.disponibleLinea;
    this.validarCanalesHabilitados(integracion, apiKeyEncriptada, disponiblePresencial, disponibleLinea, 'badRequest');

    Object.assign(pasarela, {
      ...(dto.metodo !== undefined && { metodo: dto.metodo.trim() }),
      ...(dto.descripcion !== undefined && { descripcion: dto.descripcion?.trim() || null }),
      integracion,
      apiKeyEncriptada,
      ...(dto.comisionPorcentaje !== undefined && { comisionPorcentaje: dto.comisionPorcentaje.toFixed(2) }),
      disponiblePresencial,
      disponibleLinea,
    });
    await this.pasarelaRepo.save(pasarela);

    return toPasarelaResponseDto(pasarela);
  }

  async cambiarDisponibilidad(id: number, dto: ActualizarDisponibilidadPasarelaDto): Promise<PasarelaResponseDto> {
    const pasarela = await this.pasarelaRepo.findById(id);
    if (!pasarela) throw new NotFoundException('Metodo de pago no encontrado');

    const disponiblePresencial = dto.presencial ?? pasarela.disponiblePresencial;
    const disponibleLinea = dto.linea ?? pasarela.disponibleLinea;
    this.validarCanalesHabilitados(
      pasarela.integracion,
      pasarela.apiKeyEncriptada,
      disponiblePresencial,
      disponibleLinea,
      'conflict',
    );

    pasarela.disponiblePresencial = disponiblePresencial;
    pasarela.disponibleLinea = disponibleLinea;
    await this.pasarelaRepo.save(pasarela);

    return toPasarelaResponseDto(pasarela);
  }

  private async validarCodigoDisponible(codigo: string): Promise<void> {
    const existente = await this.pasarelaRepo.findByCodigo(codigo);
    if (existente) throw new ConflictException('Ya existe un metodo de pago con ese codigo');
  }

  private validarCanalesHabilitados(
    integracion: IntegracionPago,
    apiKeyEncriptada: string | null,
    disponiblePresencial: boolean,
    disponibleLinea: boolean,
    tipoExcepcion: 'badRequest' | 'conflict',
  ): void {
    if (integracion !== 'API' || apiKeyEncriptada || (!disponiblePresencial && !disponibleLinea)) return;

    const mensaje = 'Configure las credenciales del metodo antes de habilitarlo';
    throw tipoExcepcion === 'conflict' ? new ConflictException(mensaje) : new BadRequestException(mensaje);
  }

  private cifrarCredenciales(apiKey?: string, apiSecret?: string): string | null {
    const key = apiKey?.trim();
    const secret = apiSecret?.trim();
    if (!key && !secret) return null;
    if (!key || !secret) throw new BadRequestException('Debe enviar apiKey y apiSecret juntos');

    const encryptionKey = this.config.get('payments.encryptionKey', { infer: true });
    return encrypt(JSON.stringify({ apiKey: key, apiSecret: secret }), encryptionKey);
  }
}

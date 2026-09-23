import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TemporadaRepository } from '../repositories/temporada.repository.js';
import { toTemporadaResponseDto } from '../mappers/temporada.mapper.js';
import type { CrearTemporadaDto } from '../dto/crear-temporada.dto.js';
import type { ActualizarTemporadaDto } from '../dto/actualizar-temporada.dto.js';
import type { TemporadaResponseDto } from '../dto/temporada-response.dto.js';
import type { TemporadaPublicaResponseDto } from '../dto/temporada-publica-response.dto.js';

@Injectable()
export class TemporadasService {
  constructor(private readonly temporadaRepo: TemporadaRepository) {}

  async listar(): Promise<TemporadaResponseDto[]> {
    const temporadas = await this.temporadaRepo.findAll();
    return temporadas.map(toTemporadaResponseDto);
  }

  async listarPublicas(): Promise<TemporadaPublicaResponseDto[]> {
    const temporadas = await this.temporadaRepo.findAllConCategorias();
    return temporadas.map((temporada) => ({
      ...toTemporadaResponseDto(temporada),
      categorias: temporada.temporadasCategoria
        .map((tc) => tc.categoria)
        .filter((categoria) => categoria.activo)
        .map((categoria) => ({ id: categoria.id, nombre: categoria.nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    }));
  }

  async crear(dto: CrearTemporadaDto): Promise<TemporadaResponseDto> {
    this.validarRangoFechas(dto.fechaInicio, dto.fechaFin);

    const temporada = this.temporadaRepo.create({
      nombre: dto.nombre.trim(),
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      descripcion: dto.descripcion?.trim() || null,
    });
    await this.temporadaRepo.save(temporada);

    return toTemporadaResponseDto(temporada);
  }

  async actualizar(id: number, dto: ActualizarTemporadaDto): Promise<TemporadaResponseDto> {
    const temporada = await this.temporadaRepo.findById(id);
    if (!temporada) throw new NotFoundException('Temporada no encontrada');

    const fechaInicio = dto.fechaInicio ?? temporada.fechaInicio;
    const fechaFin = dto.fechaFin ?? temporada.fechaFin;
    this.validarRangoFechas(fechaInicio, fechaFin);

    Object.assign(temporada, {
      ...(dto.nombre !== undefined && { nombre: dto.nombre.trim() }),
      fechaInicio,
      fechaFin,
      ...(dto.descripcion !== undefined && { descripcion: dto.descripcion?.trim() || null }),
    });
    await this.temporadaRepo.save(temporada);

    return toTemporadaResponseDto(temporada);
  }

  async eliminar(id: number): Promise<void> {
    const temporada = await this.temporadaRepo.findById(id);
    if (!temporada) throw new NotFoundException('Temporada no encontrada');
    await this.temporadaRepo.remove(temporada);
  }

  private validarRangoFechas(fechaInicio: string, fechaFin: string): void {
    if (fechaFin < fechaInicio) {
      throw new BadRequestException('La fecha de fin no puede ser anterior a la fecha de inicio');
    }
  }
}

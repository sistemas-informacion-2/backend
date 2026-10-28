import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CategoriaRepository } from '../repositories/categoria.repository.js';
import { TemporadaRepository } from '../repositories/temporada.repository.js';
import { TemporadaCategoriaRepository } from '../repositories/temporada-categoria.repository.js';
import { construirArbolCategorias, toCategoriaResponseDto } from '../mappers/categoria.mapper.js';
import type { CrearCategoriaDto } from '../dto/crear-categoria.dto.js';
import type { ActualizarCategoriaDto } from '../dto/actualizar-categoria.dto.js';
import type { CategoriaResponseDto } from '../dto/categoria-response.dto.js';

@Injectable()
export class CategoriasService {
  constructor(
    private readonly categoriaRepo: CategoriaRepository,
    private readonly temporadaRepo: TemporadaRepository,
    private readonly temporadaCategoriaRepo: TemporadaCategoriaRepository,
  ) {}

  async listarPublico(): Promise<CategoriaResponseDto[]> {
    const categorias = await this.categoriaRepo.findAllActivas();
    return construirArbolCategorias(categorias);
  }

  async listarTodas(): Promise<CategoriaResponseDto[]> {
    const categorias = await this.categoriaRepo.findAll();
    return construirArbolCategorias(categorias);
  }

  async crear(dto: CrearCategoriaDto): Promise<CategoriaResponseDto> {
    await this.validarSlugDisponible(dto.slug);
    if (dto.categoriaPadreId !== undefined && dto.categoriaPadreId !== null) {
      await this.validarPadre(dto.categoriaPadreId);
    }
    if (dto.temporadaIds !== undefined) await this.validarTemporadas(dto.temporadaIds);

    const categoria = this.categoriaRepo.create({
      nombre: dto.nombre,
      slug: dto.slug,
      descripcion: dto.descripcion ?? null,
      imagenUrl: dto.imagenUrl ?? null,
      idCategoriaPadre: dto.categoriaPadreId ?? null,
    });
    await this.categoriaRepo.save(categoria);

    if (dto.temporadaIds !== undefined) {
      await this.temporadaCategoriaRepo.reemplazarTemporadas(categoria.id, dto.temporadaIds);
    }

    const creada = await this.categoriaRepo.findByIdConTemporadas(categoria.id);
    return toCategoriaResponseDto(creada!);
  }

  async actualizar(id: number, dto: ActualizarCategoriaDto): Promise<CategoriaResponseDto> {
    const categoria = await this.categoriaRepo.findById(id);
    if (!categoria) throw new NotFoundException('Categoría no encontrada');

    if (dto.slug !== undefined && dto.slug !== categoria.slug) {
      await this.validarSlugDisponible(dto.slug);
    }
    if (dto.categoriaPadreId !== undefined && dto.categoriaPadreId !== null) {
      if (dto.categoriaPadreId === id) {
        throw new BadRequestException('Una categoría no puede ser su propio padre');
      }
      await this.validarPadre(dto.categoriaPadreId);
    }
    if (dto.temporadaIds !== undefined) await this.validarTemporadas(dto.temporadaIds);

    Object.assign(categoria, {
      ...(dto.nombre !== undefined && { nombre: dto.nombre }),
      ...(dto.slug !== undefined && { slug: dto.slug }),
      ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
      ...(dto.imagenUrl !== undefined && { imagenUrl: dto.imagenUrl }),
      ...(dto.categoriaPadreId !== undefined && { idCategoriaPadre: dto.categoriaPadreId }),
      ...(dto.activo !== undefined && { activo: dto.activo }),
    });
    await this.categoriaRepo.save(categoria);

    if (dto.temporadaIds !== undefined) {
      await this.temporadaCategoriaRepo.reemplazarTemporadas(id, dto.temporadaIds);
    }

    const actualizada = await this.categoriaRepo.findByIdConTemporadas(id);
    return toCategoriaResponseDto(actualizada!);
  }

  private async validarSlugDisponible(slug: string): Promise<void> {
    const existente = await this.categoriaRepo.findBySlug(slug);
    if (existente) throw new BadRequestException('El slug ya está en uso por otra categoría');
  }

  private async validarPadre(idCategoriaPadre: number): Promise<void> {
    const padre = await this.categoriaRepo.findById(idCategoriaPadre);
    if (!padre) throw new BadRequestException('La categoría padre indicada no existe');
  }

  private async validarTemporadas(idsTemporada: number[]): Promise<void> {
    const temporadas = await this.temporadaRepo.findByIds(idsTemporada);
    if (temporadas.length !== idsTemporada.length) {
      throw new UnprocessableEntityException('Una o más temporadas indicadas no existen');
    }
  }
}

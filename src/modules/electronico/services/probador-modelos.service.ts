import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { Repository } from 'typeorm';
import { VarianteProducto } from '../../inventario/entities/variante-producto.entity.js';
import type { ProbadorVarianteAdminDto } from '../dto/probador-modelo.dto.js';

const directorioModelos = join(process.cwd(), 'uploads', 'modelos');
const PREFIJO_URL = '/uploads/modelos/';

/** Nombre de archivo si la URL apunta a un modelo administrado por la app. */
function nombreArchivoGestionado(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null;
  const indice = url.indexOf(PREFIJO_URL);
  if (indice < 0) return null;
  const nombre = url.slice(indice + PREFIJO_URL.length);
  if (!nombre || /[\\/]/.test(nombre)) return null;
  return nombre;
}

/**
 * Gestion de los modelos 3D (.glb, exportados desde Blender) que se asocian a
 * una variante para el probador virtual (CU19). Solo lectura sobre la
 * variante y actualizacion del campo modelo3dUrl; los archivos viven en
 * `uploads/modelos` y se sirven por el estatico `/uploads`.
 */
@Injectable()
export class ProbadorModelosService {
  constructor(
    @InjectRepository(VarianteProducto)
    private readonly varianteRepo: Repository<VarianteProducto>,
  ) {}

  async variantes(q?: string): Promise<ProbadorVarianteAdminDto[]> {
    const builder = this.varianteRepo
      .createQueryBuilder('v')
      .innerJoinAndSelect('v.producto', 'p')
      .where('v.activo = true')
      .andWhere('p.activo = true');

    const busqueda = q?.trim();
    if (busqueda) {
      builder
        .andWhere('(v.sku ILIKE :q OR p.nombre ILIKE :q OR v.talla ILIKE :q OR v.color ILIKE :q)')
        .setParameter('q', `%${busqueda}%`);
    }

    builder.orderBy('p.nombre', 'ASC').addOrderBy('v.sku', 'ASC').limit(200);

    const variantes = await builder.getMany();
    return variantes.map((variante) => this.aDto(variante));
  }

  /** Reemplaza el modelo asociado a la variante por el archivo recien cargado. */
  async asociar(varianteId: number, nuevoModelo3dUrl: string): Promise<ProbadorVarianteAdminDto> {
    const variante = await this.varianteRepo.findOne({ where: { id: varianteId }, relations: { producto: true } });
    if (!variante || !variante.activo) {
      throw new NotFoundException('Variante no encontrada');
    }

    await this.eliminarArchivoGestionado(variante.modelo3dUrl);
    variante.modelo3dUrl = nuevoModelo3dUrl;
    const guardada = await this.varianteRepo.save(variante);
    return this.aDto(guardada);
  }

  /** Desvincula el modelo de la variante y borra el archivo si lo administramos. */
  async quitar(varianteId: number): Promise<ProbadorVarianteAdminDto> {
    const variante = await this.varianteRepo.findOne({ where: { id: varianteId }, relations: { producto: true } });
    if (!variante || !variante.activo) {
      throw new NotFoundException('Variante no encontrada');
    }

    await this.eliminarArchivoGestionado(variante.modelo3dUrl);
    variante.modelo3dUrl = null;
    const guardada = await this.varianteRepo.save(variante);
    return this.aDto(guardada);
  }

  private async eliminarArchivoGestionado(url: string | null): Promise<void> {
    const nombre = nombreArchivoGestionado(url);
    if (!nombre) return;
    await unlink(join(directorioModelos, nombre)).catch(() => undefined);
  }

  private aDto(variante: VarianteProducto): ProbadorVarianteAdminDto {
    return {
      id: variante.id,
      sku: variante.sku,
      talla: variante.talla,
      color: variante.color,
      corte: variante.corte,
      modelo3dUrl: variante.modelo3dUrl,
      producto: {
        id: variante.producto.id,
        nombre: variante.producto.nombre,
      },
    };
  }
}

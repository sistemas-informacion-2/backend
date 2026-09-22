import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { VarianteProducto } from '../../inventario/entities/variante-producto.entity.js';
import type { ProbadorVarianteDto } from '../dto/probador.dto.js';

/**
 * Provisor de assets para el probador virtual (CU19). Solo lectura sobre la
 * variante y su producto: expone lo necesario para superponer la prenda sobre
 * el canvas (color, corte, modelo 3D opcional e imagenes).
 */
@Injectable()
export class ProbadorService {
  constructor(
    @InjectRepository(VarianteProducto)
    private readonly varianteRepo: Repository<VarianteProducto>,
  ) {}

  async variante(id: number): Promise<ProbadorVarianteDto> {
    const variante = await this.varianteRepo.findOne({
      where: { id },
      relations: { producto: { imagenes: true, categoria: true } },
    });

    if (!variante || !variante.activo || !variante.producto?.activo) {
      throw new NotFoundException('Variante no encontrada para el probador virtual');
    }

    return {
      id: variante.id,
      sku: variante.sku,
      talla: variante.talla,
      color: variante.color,
      corte: variante.corte,
      modelo3dUrl: variante.modelo3dUrl,
      zonaProbador: variante.producto.categoria?.zonaProbador ?? 'SUPERIOR',
      producto: {
        id: variante.producto.id,
        nombre: variante.producto.nombre,
        descripcion: variante.producto.descripcion,
      },
      imagenes: [...variante.producto.imagenes]
        .sort((a, b) => Number(b.esPrincipal) - Number(a.esPrincipal) || a.orden - b.orden)
        .map((imagen) => ({
          id: imagen.id,
          url: imagen.url,
          esPrincipal: imagen.esPrincipal,
          orden: imagen.orden,
        })),
    };
  }
}
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Categoria } from '../entities/categoria.entity.js';

interface CategoriaSemilla {
  nombre: string;
  slug: string;
  hijas: { nombre: string; slug: string }[];
}

/**
 * Taxonomía base de categorías de ropa.
 * Es solo un punto de partida: el admin puede crear más categorías o
 * reclasificar estas desde la pantalla de Categorías.
 */
const TAXONOMIA: CategoriaSemilla[] = [
  {
    nombre: 'Ropa Superior',
    slug: 'ropa-superior',
    hijas: [
      { nombre: 'Poleras', slug: 'poleras' },
      { nombre: 'Blusas', slug: 'blusas' },
      { nombre: 'Camisas', slug: 'camisas' },
      { nombre: 'Abrigos', slug: 'abrigos' },
      { nombre: 'Chaquetas', slug: 'chaquetas' },
      { nombre: 'Suéteres', slug: 'sueteres' },
    ],
  },
  {
    nombre: 'Ropa Inferior',
    slug: 'ropa-inferior',
    hijas: [
      { nombre: 'Pantalones', slug: 'pantalones' },
      { nombre: 'Jeans', slug: 'jeans' },
      { nombre: 'Faldas', slug: 'faldas' },
      { nombre: 'Shorts', slug: 'shorts' },
    ],
  },
  {
    nombre: 'Vestidos y Enterizos',
    slug: 'vestidos-y-enterizos',
    hijas: [
      { nombre: 'Vestidos', slug: 'vestidos' },
      { nombre: 'Enterizos', slug: 'enterizos' },
      { nombre: 'Monos', slug: 'monos' },
    ],
  },
];

/** Siembra la taxonomía de categorías de ropa. Idempotente: no toca las que ya existen. */
@Injectable()
export class CategoriaSeederService {
  private readonly logger = new Logger(CategoriaSeederService.name);

  constructor(@InjectRepository(Categoria) private readonly categoriaRepo: Repository<Categoria>) {}

  async run(): Promise<void> {
    for (const padre of TAXONOMIA) {
      const idPadre = await this.asegurar(padre.nombre, padre.slug, null);
      for (const hija of padre.hijas) {
        await this.asegurar(hija.nombre, hija.slug, idPadre);
      }
    }
  }

  private async asegurar(nombre: string, slug: string, idCategoriaPadre: number | null): Promise<number> {
    const existente = await this.categoriaRepo.findOne({ where: { slug } });
    if (existente) return existente.id;

    const creada = await this.categoriaRepo.save(
      this.categoriaRepo.create({ nombre, slug, idCategoriaPadre }),
    );
    this.logger.log(`Categoría creada: ${nombre}`);
    return creada.id;
  }
}

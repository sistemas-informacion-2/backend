import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { Categoria } from '../entities/categoria.entity.js';
// Los seeders corren fuera de un request, sin TenantContext: la empresa va explicita.
import { ID_EMPRESA_INICIAL } from '../../../database/migraciones.util.js';

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

  run(): Promise<void> {
    return this.sembrarEn(this.categoriaRepo.manager, ID_EMPRESA_INICIAL);
  }

  /** Taxonomia base de una empresa. Lo usan el arranque (empresa inicial) y el alta de empresas, en su transaccion. */
  async sembrarEn(manager: EntityManager, idEmpresa: number): Promise<void> {
    const repo = manager.getRepository(Categoria);
    for (const padre of TAXONOMIA) {
      const idPadre = await this.asegurar(repo, idEmpresa, padre.nombre, padre.slug, null);
      for (const hija of padre.hijas) {
        await this.asegurar(repo, idEmpresa, hija.nombre, hija.slug, idPadre);
      }
    }
  }

  private async asegurar(
    repo: Repository<Categoria>,
    idEmpresa: number,
    nombre: string,
    slug: string,
    idCategoriaPadre: number | null,
  ): Promise<number> {
    const existente = await repo.findOne({ where: { slug, idEmpresa } });
    if (existente) return existente.id;

    const creada = await repo.save(repo.create({ nombre, slug, idCategoriaPadre, idEmpresa }));
    this.logger.log(`Categoría creada: ${nombre}`);
    return creada.id;
  }
}

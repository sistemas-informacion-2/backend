import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Categoria, type ZonaProbador } from '../entities/categoria.entity.js';

interface CategoriaSemilla {
  nombre: string;
  slug: string;
  zonaProbador: ZonaProbador;
  hijas: { nombre: string; slug: string }[];
}

/**
 * Taxonomía base de categorías de ropa, cada una con la zona del cuerpo que
 * el probador virtual (CU19) debe usar para anclar el modelo 3D de sus
 * prendas (ver `Categoria.zonaProbador` y `frontend/.../probador-ar.ts`).
 * Es solo un punto de partida: el admin puede crear más categorías o
 * reclasificar estas desde la pantalla de Categorías.
 */
const TAXONOMIA: CategoriaSemilla[] = [
  {
    nombre: 'Ropa Superior',
    slug: 'ropa-superior',
    zonaProbador: 'SUPERIOR',
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
    zonaProbador: 'INFERIOR',
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
    zonaProbador: 'COMPLETO',
    hijas: [
      { nombre: 'Vestidos', slug: 'vestidos' },
      { nombre: 'Enterizos', slug: 'enterizos' },
      { nombre: 'Monos', slug: 'monos' },
    ],
  },
];

/** Siembra la taxonomía de categorías de ropa (con su zona para el probador virtual). Idempotente: no toca las que ya existen. */
@Injectable()
export class CategoriaSeederService {
  private readonly logger = new Logger(CategoriaSeederService.name);

  constructor(@InjectRepository(Categoria) private readonly categoriaRepo: Repository<Categoria>) {}

  async run(): Promise<void> {
    for (const padre of TAXONOMIA) {
      const idPadre = await this.asegurar(padre.nombre, padre.slug, padre.zonaProbador, null);
      for (const hija of padre.hijas) {
        await this.asegurar(hija.nombre, hija.slug, padre.zonaProbador, idPadre);
      }
    }
  }

  private async asegurar(nombre: string, slug: string, zonaProbador: ZonaProbador, idCategoriaPadre: number | null): Promise<number> {
    const existente = await this.categoriaRepo.findOne({ where: { slug } });
    if (existente) return existente.id;

    const creada = await this.categoriaRepo.save(
      this.categoriaRepo.create({ nombre, slug, idCategoriaPadre, zonaProbador }),
    );
    this.logger.log(`Categoría creada: ${nombre} (zonaProbador=${zonaProbador})`);
    return creada.id;
  }
}

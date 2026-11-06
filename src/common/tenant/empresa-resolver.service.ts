import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Empresa } from '../../modules/plataforma/entities/empresa.entity.js';
import type { EmpresaActual } from './tenant-context.service.js';

/** Tiempo que se reutiliza una empresa ya buscada: casi todos los requests la necesitan. */
const TTL_MS = 60_000;

interface EntradaCache {
  empresa: EmpresaActual | null;
  vence: number;
}

/**
 * Busca empresas por slug o por id con una cache corta en memoria, para no
 * consultar la tabla empresa en cada request. Al editar o suspender una
 * empresa hay que llamar a `invalidar` para que el cambio se vea al instante
 * en esta instancia (las demas lo ven al vencer el TTL).
 */
@Injectable()
export class EmpresaResolver {
  private readonly porSlugCache = new Map<string, EntradaCache>();
  private readonly porIdCache = new Map<number, EntradaCache>();

  constructor(@InjectRepository(Empresa) private readonly repo: Repository<Empresa>) {}

  porSlug(slug: string): Promise<EmpresaActual | null> {
    return this.buscar(this.porSlugCache, slug, () => this.repo.findOne({ where: { slug } }));
  }

  porId(id: number): Promise<EmpresaActual | null> {
    return this.buscar(this.porIdCache, id, () => this.repo.findOne({ where: { id } }));
  }

  invalidar(): void {
    this.porSlugCache.clear();
    this.porIdCache.clear();
  }

  private async buscar<K>(cache: Map<K, EntradaCache>, clave: K, consultar: () => Promise<Empresa | null>): Promise<EmpresaActual | null> {
    const ahora = Date.now();
    const guardada = cache.get(clave);
    if (guardada && guardada.vence > ahora) return guardada.empresa;

    const fila = await consultar();
    const empresa = fila ? { id: fila.id, slug: fila.slug, nombre: fila.nombre, estado: fila.estado } : null;
    cache.set(clave, { empresa, vence: ahora + TTL_MS });
    return empresa;
  }
}

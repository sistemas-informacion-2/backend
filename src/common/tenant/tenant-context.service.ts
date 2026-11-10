import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { EstadoEmpresa } from '../../modules/plataforma/entities/empresa.entity.js';
import type { CodigoPlan } from '../../modules/plataforma/entities/plan.entity.js';
import { EmpresaResolver } from './empresa-resolver.service.js';

/** Lo del plan que se revisa en cada request: funciones habilitadas y limites (null = sin limite). */
export interface PlanActual {
  codigo: CodigoPlan;
  nombre: string;
  maxUsuarios: number | null;
  maxSucursales: number | null;
  maxAlmacenes: number | null;
  reportesAvanzados: boolean;
  bi: boolean;
}

/** Lo minimo de la empresa que necesita cualquier capa durante un request. */
export interface EmpresaActual {
  id: number;
  slug: string;
  nombre: string;
  estado: EstadoEmpresa;
  plan: PlanActual;
  /** null = el plan no vence. */
  planVenceEl: Date | null;
}

const CLAVE_EMPRESA = 'empresa';

/**
 * Empresa del request en curso (o del trabajo en segundo plano), guardada en
 * AsyncLocalStorage via nestjs-cls: cualquier service o repositorio la lee sin
 * que haya que pasarla por parametro desde el controller.
 */
@Injectable()
export class TenantContext {
  constructor(
    private readonly cls: ClsService,
    private readonly resolver: EmpresaResolver,
  ) {}

  establecer(empresa: EmpresaActual): void {
    this.cls.set(CLAVE_EMPRESA, empresa);
  }

  /** null en rutas sin empresa (plataforma) o fuera de un contexto CLS. */
  empresa(): EmpresaActual | null {
    if (!this.cls.isActive()) return null;
    return this.cls.get<EmpresaActual | undefined>(CLAVE_EMPRESA) ?? null;
  }

  /**
   * Id de la empresa actual. Falla en vez de devolver un valor por defecto:
   * una consulta sin empresa podria mezclar datos de varias tiendas.
   */
  empresaId(): number {
    return this.empresaRequerida().id;
  }

  /** La empresa actual completa (con su plan); falla igual que empresaId() si no hay ninguna. */
  empresaRequerida(): EmpresaActual {
    const empresa = this.empresa();
    if (!empresa) {
      throw new InternalServerErrorException('Esta operacion requiere una empresa y no hay ninguna en el contexto');
    }
    return empresa;
  }

  /** Corre `tarea` dentro de un contexto propio con `empresa`: para cron y tareas fuera de un request. */
  ejecutarComo<T>(empresa: EmpresaActual, tarea: () => Promise<T>): Promise<T> {
    return this.cls.run(() => {
      this.establecer(empresa);
      return tarea();
    });
  }

  /** Como `ejecutarComo`, a partir del id de la empresa (p. ej. el de una fila que procesa un trabajo en segundo plano). */
  async ejecutarParaEmpresa<T>(idEmpresa: number, tarea: () => Promise<T>): Promise<T> {
    const empresa = await this.resolver.porId(idEmpresa);
    if (!empresa) throw new InternalServerErrorException(`La empresa ${idEmpresa} no existe`);
    return this.ejecutarComo(empresa, tarea);
  }
}

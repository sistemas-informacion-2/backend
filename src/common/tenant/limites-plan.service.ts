import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { TenantContext } from './tenant-context.service.js';

export type RecursoLimitado = 'usuarios' | 'sucursales' | 'almacenes';

export interface UsoPlan {
  usuarios: number;
  sucursales: number;
  almacenes: number;
}

/** Codigo en el campo `error` de la respuesta: el frontend lo usa para ofrecer Mi plan. */
export const ERROR_LIMITE_PLAN = 'LIMITE_PLAN';

/** Que se cuenta en cada recurso: solo lo activo; los usuarios, solo el personal interno (los clientes no cuentan). */
const CONTEO: Record<RecursoLimitado, string> = {
  usuarios: `SELECT count(*)::int AS total FROM usuario WHERE id_empresa = $1 AND activo AND tipo_usuario IN ('A', 'E')`,
  sucursales: `SELECT count(*)::int AS total FROM sucursal WHERE id_empresa = $1 AND activo`,
  almacenes: `SELECT count(*)::int AS total FROM almacen WHERE id_empresa = $1 AND activo`,
};

const NOMBRE: Record<RecursoLimitado, { singular: string; plural: string }> = {
  usuarios: { singular: 'usuario activo', plural: 'usuarios activos' },
  sucursales: { singular: 'sucursal activa', plural: 'sucursales activas' },
  almacenes: { singular: 'almacén activo', plural: 'almacenes activos' },
};

/**
 * Limites del plan de la empresa actual. Se llama antes de crear (o reactivar) un usuario interno, una sucursal o
 * un almacen. Bajar de plan no borra nada: si ya hay mas de lo permitido, solo impide sumar otro.
 */
@Injectable()
export class LimitesPlanService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenant: TenantContext,
  ) {}

  /** Lanza 403 LIMITE_PLAN si agregar uno mas superaria el limite del plan. */
  async verificar(recurso: RecursoLimitado, manager?: EntityManager): Promise<void> {
    const empresa = this.tenant.empresa();
    // Fuera de un request (seeders) no hay plan que hacer cumplir.
    if (!empresa) return;

    const maximo = this.maximo(recurso);
    if (maximo === null) return;

    const actuales = await this.contar(recurso, empresa.id, manager);
    if (actuales + 1 > maximo) {
      const nombre = maximo === 1 ? NOMBRE[recurso].singular : NOMBRE[recurso].plural;
      throw new ForbiddenException({
        message: `Tu plan ${empresa.plan.nombre} permite hasta ${maximo} ${nombre}. Cambia de plan desde Mi plan para agregar más.`,
        error: ERROR_LIMITE_PLAN,
      });
    }
  }

  async uso(): Promise<UsoPlan> {
    const id = this.tenant.empresaId();
    const [usuarios, sucursales, almacenes] = await Promise.all([
      this.contar('usuarios', id),
      this.contar('sucursales', id),
      this.contar('almacenes', id),
    ]);
    return { usuarios, sucursales, almacenes };
  }

  private maximo(recurso: RecursoLimitado): number | null {
    const plan = this.tenant.empresaRequerida().plan;
    if (recurso === 'usuarios') return plan.maxUsuarios;
    if (recurso === 'sucursales') return plan.maxSucursales;
    return plan.maxAlmacenes;
  }

  private async contar(recurso: RecursoLimitado, idEmpresa: number, manager?: EntityManager): Promise<number> {
    const filas: Array<{ total: number }> = await (manager ?? this.dataSource.manager).query(CONTEO[recurso], [idEmpresa]);
    return filas[0]?.total ?? 0;
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { EmpleadoSucursal } from '../entities/empleado-sucursal.entity.js';

/**
 * CRUD de EMPLEADO_SUCURSAL (asignacion de un empleado a una o varias sucursales).
 * Distinto del EmpleadoSucursalRepository de solo lectura en acceso/, que solo
 * resuelve la sucursal activa del empleado logueado (login/perfil).
 */
@Injectable()
export class AsignacionSucursalRepository {
  constructor(
    @InjectRepository(EmpleadoSucursal) private readonly repo: Repository<EmpleadoSucursal>,
  ) {}

  findByEmpleadoConSucursal(
    idEmpleado: number,
    manager: EntityManager = this.repo.manager,
  ): Promise<EmpleadoSucursal[]> {
    return manager.getRepository(EmpleadoSucursal).find({
      where: { idEmpleado },
      relations: { sucursal: true },
      order: { fechaAsignacion: 'DESC' },
    });
  }

  async reemplazarAsignaciones(
    idEmpleado: number,
    idsSucursal: number[],
    manager: EntityManager = this.repo.manager,
  ): Promise<void> {
    const repository = manager.getRepository(EmpleadoSucursal);
    const existentes = await repository.find({ where: { idEmpleado } });
    const deseados = new Set(idsSucursal);

    const existentesIds = new Set(
      existentes.filter((asignacion) => asignacion.activo).map((asignacion) => asignacion.idSucursal),
    );
    const aEliminar = existentes.filter(
      (asignacion) => !asignacion.activo || !deseados.has(asignacion.idSucursal),
    );
    const aCrear = idsSucursal
      .filter((idSucursal) => !existentesIds.has(idSucursal))
      .map((idSucursal) => [idEmpleado, idSucursal]);

    if (aEliminar.length > 0) await repository.remove(aEliminar);
    for (const [empleadoId, sucursalId] of aCrear) {
      await manager.query(
        `INSERT INTO empleado_sucursal (id_empleado, id_sucursal, activo)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (id_empleado, id_sucursal) DO NOTHING`,
        [empleadoId, sucursalId],
      );
    }
  }
}

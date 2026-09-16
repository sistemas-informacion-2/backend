import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { EmpleadoSucursal } from '../../operaciones/entities/empleado-sucursal.entity.js';

/**
 * Vive en acceso/ porque hoy solo lo consume AuthService (para resolver la
 * sucursal activa del empleado en el login/perfil). La entidad sigue siendo
 * propiedad de operaciones/ — se trasladará junto al resto del CRUD de
 * sucursales cuando se implemente CU06/CU26.
 */
@Injectable()
export class EmpleadoSucursalRepository {
  constructor(
    @InjectRepository(EmpleadoSucursal) private readonly repo: Repository<EmpleadoSucursal>,
  ) {}

  findActivaPorEmpleado(idEmpleado: number): Promise<EmpleadoSucursal | null> {
    return this.repo.findOne({
      where: { idEmpleado, activo: true },
      order: { fechaAsignacion: 'DESC' },
    });
  }

  findActivaPorSucursalConDatos(idSucursal: number): Promise<EmpleadoSucursal | null> {
    return this.repo.findOne({
      where: { idSucursal },
      relations: { sucursal: true },
    });
  }
}

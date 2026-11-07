import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Sucursal } from '../entities/sucursal.entity.js';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';

const RELACIONES_CON_UBICACION = { ciudad: { departamento: true } } as const;

@Injectable()
export class SucursalRepository {
  constructor(
    @InjectRepository(Sucursal) private readonly repo: Repository<Sucursal>,
    private readonly tenant: TenantContext,
  ) {}

  findAllConUbicacion(): Promise<Sucursal[]> {
    return this.repo.find({ where: { idEmpresa: this.tenant.empresaId() }, relations: RELACIONES_CON_UBICACION, order: { nombre: 'ASC' } });
  }

  findByIdConUbicacion(id: number): Promise<Sucursal | null> {
    return this.repo.findOne({ where: { id, idEmpresa: this.tenant.empresaId() }, relations: RELACIONES_CON_UBICACION });
  }

  create(datos: Partial<Sucursal>): Sucursal {
    return this.repo.create(datos);
  }

  save(sucursal: Sucursal): Promise<Sucursal> {
    return this.repo.save(sucursal);
  }
}

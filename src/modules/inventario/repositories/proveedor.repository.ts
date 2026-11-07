import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, type Repository } from 'typeorm';
import { Proveedor } from '../entities/proveedor.entity.js';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';

@Injectable()
export class ProveedorRepository {
  constructor(
    @InjectRepository(Proveedor) private readonly repo: Repository<Proveedor>,
    private readonly tenant: TenantContext,
  ) {}

  findWithFilters(query: { search?: string; activo?: boolean }): Promise<Proveedor[]> {
    const builder = this.repo
      .createQueryBuilder('proveedor')
      .where('proveedor.id_empresa = :idEmpresa', { idEmpresa: this.tenant.empresaId() })
      .orderBy('proveedor.empresa', 'ASC');

    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      builder.andWhere(
        new Brackets((where) => {
          where
            .where('LOWER(proveedor.nit) LIKE :search', { search })
            .orWhere('LOWER(proveedor.empresa) LIKE :search', { search })
            .orWhere('LOWER(proveedor.nombre_contacto) LIKE :search', { search });
        }),
      );
    }
    if (query.activo !== undefined) builder.andWhere('proveedor.activo = :activo', { activo: query.activo });

    return builder.getMany();
  }

  findById(id: number): Promise<Proveedor | null> {
    return this.repo.findOne({ where: { id, idEmpresa: this.tenant.empresaId() } });
  }

  findByNit(nit: string): Promise<Proveedor | null> {
    return this.repo.findOne({ where: { nit, idEmpresa: this.tenant.empresaId() } });
  }

  create(datos: Partial<Proveedor>): Proveedor {
    return this.repo.create(datos);
  }

  save(proveedor: Proveedor): Promise<Proveedor> {
    return this.repo.save(proveedor);
  }
}

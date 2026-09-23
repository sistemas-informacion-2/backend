import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { NotaCompra } from '../entities/nota-compra.entity.js';
import type { ComprasQueryDto } from '../dto/compras-query.dto.js';

export interface FiltrosCompra extends Omit<ComprasQueryDto, 'idSucursal'> {
  /** Sucursales visibles para el usuario; `undefined` = todas (administrador). */
  idsSucursal?: number[];
  idSucursal?: number;
}

@Injectable()
export class CompraRepository {
  constructor(@InjectRepository(NotaCompra) private readonly repo: Repository<NotaCompra>) {}

  async findPage(filtros: FiltrosCompra): Promise<{ items: NotaCompra[]; total: number }> {
    const builder = this.repo
      .createQueryBuilder('compra')
      .leftJoinAndSelect('compra.proveedor', 'proveedor')
      .leftJoinAndSelect('compra.sucursal', 'sucursal')
      // Se traen las lineas solo para contarlas; el listado no las expone (ver toCompraResponseDto).
      .leftJoinAndSelect('compra.detalles', 'detalle');

    if (filtros.idsSucursal) builder.andWhere('compra.id_sucursal IN (:...idsSucursal)', { idsSucursal: filtros.idsSucursal });
    if (filtros.idSucursal !== undefined) builder.andWhere('compra.id_sucursal = :idSucursal', { idSucursal: filtros.idSucursal });
    if (filtros.idProveedor !== undefined) builder.andWhere('compra.id_proveedor = :idProveedor', { idProveedor: filtros.idProveedor });
    if (filtros.nroFactura?.trim()) {
      builder.andWhere('LOWER(compra.nro_factura) LIKE :nroFactura', {
        nroFactura: `%${filtros.nroFactura.trim().toLowerCase()}%`,
      });
    }
    if (filtros.fechaDesde) builder.andWhere('compra.fecha_emision >= :fechaDesde', { fechaDesde: filtros.fechaDesde });
    if (filtros.fechaHasta) {
      // La fecha limite incluye todo ese dia, no solo su medianoche.
      builder.andWhere("compra.fecha_emision < (:fechaHasta::date + interval '1 day')", { fechaHasta: filtros.fechaHasta });
    }

    const [items, total] = await builder
      .orderBy('compra.id', 'DESC')
      .skip((filtros.page - 1) * filtros.limit)
      .take(filtros.limit)
      .getManyAndCount();

    return { items, total };
  }

  findByIdConDetalle(id: number): Promise<NotaCompra | null> {
    return this.repo.findOne({
      where: { id },
      relations: {
        proveedor: true,
        sucursal: true,
        detalles: { variante: { producto: true }, almacen: true },
      },
    });
  }

  findPorFactura(idProveedor: number, nroFactura: string): Promise<NotaCompra | null> {
    return this.repo
      .createQueryBuilder('compra')
      .where('compra.id_proveedor = :idProveedor', { idProveedor })
      .andWhere('LOWER(compra.nro_factura) = :nroFactura', { nroFactura: nroFactura.toLowerCase() })
      .getOne();
  }
}

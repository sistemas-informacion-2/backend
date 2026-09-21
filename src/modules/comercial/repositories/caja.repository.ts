import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Caja, type EstadoCaja } from '../entities/caja.entity.js';

@Injectable()
export class CajaRepository {
  constructor(@InjectRepository(Caja) private readonly repo: Repository<Caja>) {}

  findWithFilters(query: {
    idSucursal?: number;
    estado?: EstadoCaja;
    fechaDesde?: string;
    fechaHasta?: string;
  }): Promise<Caja[]> {
    const builder = this.detalleQuery().orderBy('caja.fecha_apertura', 'DESC');

    if (query.idSucursal !== undefined) builder.andWhere('caja.id_sucursal = :idSucursal', { idSucursal: query.idSucursal });
    if (query.estado !== undefined) builder.andWhere('caja.estado = :estado', { estado: query.estado });
    if (query.fechaDesde !== undefined) {
      builder.andWhere('caja.fecha_apertura >= :fechaDesde', { fechaDesde: new Date(query.fechaDesde) });
    }
    if (query.fechaHasta !== undefined) {
      builder.andWhere('caja.fecha_apertura <= :fechaHasta', { fechaHasta: new Date(query.fechaHasta) });
    }

    return builder.getMany();
  }

  findByIdConDetalle(id: number): Promise<Caja | null> {
    return this.detalleQuery().where('caja.id = :id', { id }).getOne();
  }

  findAbiertaPorSucursal(idSucursal: number): Promise<Caja | null> {
    return this.detalleQuery()
      .where('caja.id_sucursal = :idSucursal', { idSucursal })
      .andWhere('caja.estado = :estado', { estado: 'Abierta' })
      .getOne();
  }

  create(datos: Partial<Caja>): Caja {
    return this.repo.create(datos);
  }

  save(caja: Caja): Promise<Caja> {
    return this.repo.save(caja);
  }

  private detalleQuery() {
    return this.repo
      .createQueryBuilder('caja')
      .leftJoinAndSelect('caja.sucursal', 'sucursal')
      .leftJoinAndSelect('caja.cajero', 'cajero')
      .leftJoinAndSelect('cajero.usuario', 'cajeroUsuario')
      .leftJoinAndSelect('caja.movimientos', 'movimiento');
  }
}

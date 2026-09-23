import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Caja, type EstadoCaja } from '../entities/caja.entity.js';
import { Pago } from '../entities/pago.entity.js';

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

  /**
   * Cobros por internet de la sucursal durante el turno de la caja: pagos sin movimiento de caja (no pasaron por el
   * cajon) de compras en linea asignadas a la sucursal o de anticipos de reservas hechas en ella.
   */
  findCobrosEnLinea(caja: Caja): Promise<Pago[]> {
    return this.repo.manager
      .getRepository(Pago)
      .createQueryBuilder('pago')
      .leftJoinAndSelect('pago.notaVenta', 'nota')
      .leftJoinAndSelect('pago.reserva', 'reserva')
      .leftJoinAndSelect('pago.pasarela', 'pasarela')
      .where('pago.id_movimiento_caja IS NULL')
      .andWhere('pago.id_pasarela IS NOT NULL')
      .andWhere('pago.monto > 0')
      .andWhere("pago.concepto IN ('PAGO_TOTAL', 'ANTICIPO_RESERVA')")
      .andWhere('(nota.id_sucursal = :idSucursal OR reserva.id_sucursal = :idSucursal)', { idSucursal: caja.idSucursal })
      .andWhere('(pago.fecha_pago + pago.hora_pago) >= :desde', { desde: caja.fechaApertura })
      .andWhere('(pago.fecha_pago + pago.hora_pago) <= :hasta', { hasta: caja.fechaCierre ?? new Date() })
      .orderBy('pago.id', 'ASC')
      .getMany();
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

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, LessThan, type Repository } from 'typeorm';
import { NotaVenta } from '../../comercial/entities/nota-venta.entity.js';
import { Reserva, type EstadoReserva } from '../entities/reserva.entity.js';

export interface FiltrosReservas {
  page: number;
  limit: number;
  search?: string;
  estado?: EstadoReserva;
  idSucursal?: number;
  /** Restriccion de visibilidad del empleado: solo sus sucursales. */
  idsSucursal?: number[];
  idCliente?: number;
}

const RELACIONES_DETALLE = {
  cliente: { usuario: true },
  sucursal: true,
  detalles: { variante: { producto: true } },
  pagos: { pasarela: true },
} as const;

@Injectable()
export class ReservaRepository {
  constructor(@InjectRepository(Reserva) private readonly repo: Repository<Reserva>) {}

  async findPage(query: FiltrosReservas): Promise<{ items: Reserva[]; total: number }> {
    const builder = this.repo
      .createQueryBuilder('reserva')
      .leftJoinAndSelect('reserva.cliente', 'cliente')
      .leftJoinAndSelect('cliente.usuario', 'clienteUsuario')
      .leftJoinAndSelect('reserva.sucursal', 'sucursal')
      .leftJoinAndSelect('reserva.pagos', 'pago')
      .orderBy('reserva.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.estado) builder.andWhere('reserva.estado = :estado', { estado: query.estado });
    if (query.idSucursal !== undefined) builder.andWhere('reserva.id_sucursal = :idSucursal', { idSucursal: query.idSucursal });
    if (query.idsSucursal) builder.andWhere('reserva.id_sucursal IN (:...idsSucursal)', { idsSucursal: query.idsSucursal });
    if (query.idCliente !== undefined) builder.andWhere('reserva.id_cliente = :idCliente', { idCliente: query.idCliente });
    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      builder.andWhere(
        new Brackets((where) => {
          where
            .where('LOWER(reserva.codigo_reserva) LIKE :search', { search })
            .orWhere('LOWER(clienteUsuario.nombre) LIKE :search', { search })
            .orWhere('LOWER(clienteUsuario.apellido) LIKE :search', { search });
        }),
      );
    }

    const [items, total] = await builder.getManyAndCount();
    return { items, total };
  }

  findByIdConDetalle(id: number): Promise<Reserva | null> {
    return this.repo.findOne({ where: { id }, relations: RELACIONES_DETALLE });
  }

  findByCliente(idCliente: number): Promise<Reserva[]> {
    return this.repo.find({ where: { idCliente }, relations: RELACIONES_DETALLE, order: { id: 'DESC' } });
  }

  /** Reservas que siguen apartando stock (PENDIENTE/PAGADA) y ya pasaron su fecha limite. */
  async findIdsVencidas(ahora: Date): Promise<number[]> {
    const vencidas = await this.repo.find({
      select: { id: true },
      where: { estado: In<EstadoReserva>(['PENDIENTE', 'PAGADA']), fechaLimite: LessThan(ahora) },
      order: { id: 'ASC' },
    });
    return vencidas.map((reserva) => reserva.id);
  }

  findNotaVenta(idReserva: number): Promise<NotaVenta | null> {
    return this.repo.manager.getRepository(NotaVenta).findOne({ where: { idReserva } });
  }
}

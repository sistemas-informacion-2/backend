import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, type EntityManager, type Repository } from 'typeorm';
import { DetalleNotaDevolucion } from '../entities/detalle-nota-devolucion.entity.js';
import { NotaDevolucion, type TipoDevolucion } from '../entities/nota-devolucion.entity.js';

export interface FiltrosDevoluciones {
  page: number;
  limit: number;
  search?: string;
  tipoDevolucion?: TipoDevolucion;
  idSucursal?: number;
  /** Restriccion de visibilidad del empleado: solo sus sucursales. */
  idsSucursal?: number[];
  idCliente?: number;
  fechaDesde?: string;
  fechaHasta?: string;
}

@Injectable()
export class DevolucionRepository {
  constructor(@InjectRepository(NotaDevolucion) private readonly repo: Repository<NotaDevolucion>) {}

  async findPage(query: FiltrosDevoluciones): Promise<{ items: NotaDevolucion[]; total: number }> {
    const builder = this.repo
      .createQueryBuilder('devolucion')
      .leftJoinAndSelect('devolucion.cliente', 'cliente')
      .leftJoinAndSelect('cliente.usuario', 'clienteUsuario')
      .leftJoinAndSelect('devolucion.cajero', 'cajero')
      .leftJoinAndSelect('cajero.usuario', 'cajeroUsuario')
      .leftJoinAndSelect('devolucion.sucursal', 'sucursal')
      .leftJoinAndSelect('devolucion.notaVenta', 'notaVenta')
      .leftJoinAndSelect('devolucion.reserva', 'reserva')
      .orderBy('devolucion.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.tipoDevolucion) builder.andWhere('devolucion.tipo_devolucion = :tipo', { tipo: query.tipoDevolucion });
    if (query.idSucursal !== undefined) builder.andWhere('devolucion.id_sucursal = :idSucursal', { idSucursal: query.idSucursal });
    if (query.idsSucursal) builder.andWhere('devolucion.id_sucursal IN (:...idsSucursal)', { idsSucursal: query.idsSucursal });
    if (query.idCliente !== undefined) builder.andWhere('devolucion.id_cliente = :idCliente', { idCliente: query.idCliente });
    if (query.fechaDesde) builder.andWhere('devolucion.fecha_emision >= :fechaDesde', { fechaDesde: query.fechaDesde });
    if (query.fechaHasta) builder.andWhere("devolucion.fecha_emision < (:fechaHasta::date + interval '1 day')", { fechaHasta: query.fechaHasta });
    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      builder.andWhere(
        new Brackets((where) => {
          where
            .where('LOWER(devolucion.codigo_devolucion) LIKE :search', { search })
            .orWhere('LOWER(notaVenta.codigo_nota) LIKE :search', { search })
            .orWhere('LOWER(reserva.codigo_reserva) LIKE :search', { search })
            .orWhere('LOWER(clienteUsuario.nombre) LIKE :search', { search })
            .orWhere('LOWER(clienteUsuario.apellido) LIKE :search', { search });
        }),
      );
    }

    const [items, total] = await builder.getManyAndCount();
    return { items, total };
  }

  findByIdConDetalle(id: number): Promise<NotaDevolucion | null> {
    return this.repo.findOne({
      where: { id },
      relations: {
        cliente: { usuario: true },
        cajero: { usuario: true },
        sucursal: true,
        notaVenta: true,
        reserva: true,
        detalles: { variante: { producto: true }, almacen: true },
      },
    });
  }

  /** Unidades ya devueltas de cada variante de una nota de venta (todas las devoluciones previas). */
  async unidadesDevueltasPorVariante(idNotaVenta: number, manager: EntityManager = this.repo.manager): Promise<Map<number, number>> {
    const filas = await manager
      .getRepository(DetalleNotaDevolucion)
      .createQueryBuilder('detalle')
      .innerJoin('detalle.notaDevolucion', 'nota')
      .select('detalle.idVarianteProducto', 'idVariante')
      .addSelect('SUM(detalle.cantidad)', 'cantidad')
      .where('nota.idNotaVenta = :idNotaVenta', { idNotaVenta })
      .groupBy('detalle.idVarianteProducto')
      .getRawMany<{ idVariante: number | null; cantidad: string }>();

    const devueltas = new Map<number, number>();
    for (const fila of filas) {
      if (fila.idVariante !== null) devueltas.set(Number(fila.idVariante), Number(fila.cantidad));
    }
    return devueltas;
  }

  /** Dinero ya reembolsado por devoluciones de una reserva cancelada. */
  async montoReembolsadoDeReserva(idReserva: number, manager: EntityManager = this.repo.manager): Promise<number> {
    const fila = await manager
      .getRepository(NotaDevolucion)
      .createQueryBuilder('nota')
      .select('COALESCE(SUM(nota.montoTotalReembolsado), 0)', 'total')
      .where('nota.idReserva = :idReserva', { idReserva })
      .getRawOne<{ total: string }>();
    return Number(fila?.total ?? 0);
  }
}

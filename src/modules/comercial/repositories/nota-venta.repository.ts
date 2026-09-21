import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, type EntityManager, type Repository } from 'typeorm';
import { NotaVenta, type TipoNotaVenta } from '../entities/nota-venta.entity.js';

interface FiltrosVentas {
  page: number;
  limit: number;
  search?: string;
  idSucursal?: number;
  idCajero?: number;
  idCliente?: number;
  /** Solo notas de este tipo (p. ej. E_COMMERCE para las ventas en linea). */
  tipoVenta?: TipoNotaVenta;
  /** Sin notas de este tipo: las ventas presenciales no incluyen las de la tienda en linea. */
  excluirTipoVenta?: TipoNotaVenta;
  /** Restriccion de visibilidad del empleado: solo sus sucursales. */
  idsSucursal?: number[];
  fechaDesde?: string;
  fechaHasta?: string;
}

@Injectable()
export class NotaVentaRepository {
  constructor(@InjectRepository(NotaVenta) private readonly repo: Repository<NotaVenta>) {}

  async findPage(query: FiltrosVentas): Promise<{ items: NotaVenta[]; total: number }> {
    const builder = this.repo
      .createQueryBuilder('venta')
      .leftJoinAndSelect('venta.cliente', 'cliente')
      .leftJoinAndSelect('cliente.usuario', 'clienteUsuario')
      .leftJoinAndSelect('venta.cajero', 'cajero')
      .leftJoinAndSelect('cajero.usuario', 'cajeroUsuario')
      .leftJoinAndSelect('venta.sucursal', 'sucursal')
      .leftJoinAndSelect('venta.pasarela', 'pasarelaVenta')
      .orderBy('venta.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.idSucursal !== undefined) builder.andWhere('venta.id_sucursal = :idSucursal', { idSucursal: query.idSucursal });
    if (query.tipoVenta) builder.andWhere('venta.tipo_venta = :tipoVenta', { tipoVenta: query.tipoVenta });
    if (query.excluirTipoVenta) builder.andWhere('venta.tipo_venta <> :excluirTipoVenta', { excluirTipoVenta: query.excluirTipoVenta });
    if (query.idsSucursal) builder.andWhere('venta.id_sucursal IN (:...idsSucursal)', { idsSucursal: query.idsSucursal });
    if (query.idCliente !== undefined) builder.andWhere('venta.id_cliente = :idCliente', { idCliente: query.idCliente });
    if (query.idCajero !== undefined) builder.andWhere('venta.id_cajero = :idCajero', { idCajero: query.idCajero });
    if (query.fechaDesde !== undefined) builder.andWhere('venta.fecha_emision >= :fechaDesde', { fechaDesde: query.fechaDesde });
    if (query.fechaHasta !== undefined) builder.andWhere('venta.fecha_emision <= :fechaHasta', { fechaHasta: query.fechaHasta });
    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      builder.andWhere(
        new Brackets((where) => {
          where
            .where('LOWER(venta.codigo_nota) LIKE :search', { search })
            .orWhere('LOWER(venta.nro_factura) LIKE :search', { search })
            .orWhere('LOWER(clienteUsuario.nombre) LIKE :search', { search })
            .orWhere('LOWER(clienteUsuario.apellido) LIKE :search', { search });
        }),
      );
    }

    const [items, total] = await builder.getManyAndCount();
    return { items, total };
  }

  findByIdConDetalle(id: number): Promise<NotaVenta | null> {
    return this.repo
      .createQueryBuilder('venta')
      .leftJoinAndSelect('venta.cliente', 'cliente')
      .leftJoinAndSelect('cliente.usuario', 'clienteUsuario')
      .leftJoinAndSelect('venta.cajero', 'cajero')
      .leftJoinAndSelect('cajero.usuario', 'cajeroUsuario')
      .leftJoinAndSelect('venta.sucursal', 'sucursal')
      .leftJoinAndSelect('venta.pasarela', 'pasarelaVenta')
      .leftJoinAndSelect('venta.detalles', 'detalle')
      .leftJoinAndSelect('detalle.variante', 'variante')
      .leftJoinAndSelect('variante.producto', 'producto')
      .leftJoinAndSelect('venta.pagos', 'pago')
      .leftJoinAndSelect('pago.pasarela', 'pasarela')
      .where('venta.id = :id', { id })
      .getOne();
  }

  count(manager: EntityManager = this.repo.manager): Promise<number> {
    return manager.getRepository(NotaVenta).count();
  }

  create(datos: Partial<NotaVenta>, manager: EntityManager = this.repo.manager): NotaVenta {
    return manager.getRepository(NotaVenta).create(datos);
  }

  save(venta: NotaVenta, manager: EntityManager = this.repo.manager): Promise<NotaVenta> {
    return manager.getRepository(NotaVenta).save(venta);
  }
}

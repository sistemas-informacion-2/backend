import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, type EntityManager } from 'typeorm';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { NotaVenta } from '../../comercial/entities/nota-venta.entity.js';
import { Almacen } from '../../inventario/entities/almacen.entity.js';
import { Inventario } from '../../inventario/entities/inventario.entity.js';
import { ProductoSucursal } from '../../inventario/entities/producto-sucursal.entity.js';
import { VarianteProducto } from '../../inventario/entities/variante-producto.entity.js';
import { precioConDescuento } from '../../inventario/utils/precio.util.js';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';
import { CODIGO_COMPRA_SIN_STOCK, type EstadoCompraOfflineDto, type SincronizarCompraOfflineDto } from '../dto/compra-offline.dto.js';
import { Carrito } from '../entities/carrito.entity.js';
import { DetalleCarrito } from '../entities/detalle-carrito.entity.js';

function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

interface LineaCompraOffline {
  idVariante: number;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

/**
 * RF-SYNC-01. Compra directa hecha sin conexion que llega al volver la red.
 *
 * Sin red no se puede cobrar, y Stripe exige que el cliente autorice en su pagina. Por eso aqui solo se valida el stock
 * y la compra queda lista en el carrito: el cliente paga el total en el checkout normal, que es quien descuenta el
 * inventario y emite la Nota de Venta E-Commerce. Nunca crea una reserva ni cobra importes parciales.
 */
@Injectable()
export class ComprasOfflineService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async sincronizar(dto: SincronizarCompraOfflineDto, usuario: ActiveUser): Promise<EstadoCompraOfflineDto> {
    const idCliente = this.idCliente(usuario);
    // Un reenvio tardio de la cola no debe volver a llenar el carrito de una compra ya pagada.
    const completada = await this.notaDe(dto.idLocal, idCliente);
    if (completada) return this.estadoCompletada(dto.idLocal, completada);

    const preciosVistos = new Map(dto.detalles.map((detalle) => [detalle.idVariante, Number(detalle.precioUnitario)]));
    const lineas = await this.dataSource.transaction(async (manager) => {
      const sucursal = await manager.getRepository(Sucursal).findOne({ where: { id: dto.idSucursal } });
      if (!sucursal) throw new NotFoundException('Sucursal no encontrada');
      if (!sucursal.activo) throw new ConflictException('La sucursal esta inactiva');

      const nuevas = await this.construirLineas(manager, dto);
      await this.validarStock(manager, dto.idSucursal, nuevas);
      await this.dejarEnCarrito(manager, idCliente, dto, nuevas);
      return nuevas;
    });

    return {
      idLocal: dto.idLocal,
      estadoSincronizacion: 'PENDIENTE_PAGO',
      montoTotal: redondear(lineas.reduce((suma, linea) => suma + linea.subtotal, 0)),
      codigoNota: null,
      preciosActualizados: lineas.some((linea) => Math.abs((preciosVistos.get(linea.idVariante) ?? linea.precioUnitario) - linea.precioUnitario) > 0.005),
    };
  }

  /** Para saber, despues de pagar, si esta compra ya tiene su Nota de Venta. */
  async estado(idLocal: string, usuario: ActiveUser): Promise<EstadoCompraOfflineDto> {
    const nota = await this.notaDe(idLocal, this.idCliente(usuario));
    return nota ? this.estadoCompletada(idLocal, nota) : { idLocal, estadoSincronizacion: 'PENDIENTE_PAGO', montoTotal: 0, codigoNota: null, preciosActualizados: false };
  }

  private idCliente(usuario: ActiveUser): number {
    if (usuario.tipoUsuario !== 'C') throw new ForbiddenException('Solo un cliente puede sincronizar sus compras');
    return usuario.sub;
  }

  private notaDe(idLocal: string, idCliente: number): Promise<NotaVenta | null> {
    return this.dataSource.getRepository(NotaVenta).findOne({ where: { idLocalOffline: idLocal, idCliente } });
  }

  private estadoCompletada(idLocal: string, nota: NotaVenta): EstadoCompraOfflineDto {
    return { idLocal, estadoSincronizacion: 'COMPLETADA', montoTotal: Number(nota.montoTotal), codigoNota: nota.codigoNota, preciosActualizados: false };
  }

  private async construirLineas(manager: EntityManager, dto: SincronizarCompraOfflineDto): Promise<LineaCompraOffline[]> {
    const cantidades = new Map<number, number>();
    for (const detalle of dto.detalles) cantidades.set(detalle.idVariante, (cantidades.get(detalle.idVariante) ?? 0) + detalle.cantidad);
    // Ordenadas: las filas se bloquean siempre en el mismo orden, sin interbloqueos.
    const ids = [...cantidades.keys()].sort((a, b) => a - b);

    const variantes = await manager.getRepository(VarianteProducto).find({ where: { id: In(ids) }, relations: { producto: true } });
    const activados = await manager.getRepository(ProductoSucursal).find({
      where: { idSucursal: dto.idSucursal, idProducto: In([...new Set(variantes.map((variante) => variante.idProducto))]), activo: true },
    });

    return ids.map((id) => {
      const variante = variantes.find((candidata) => candidata.id === id);
      if (!variante) throw new NotFoundException(`Variante ${id} no encontrada`);
      if (!variante.activo || !variante.producto?.activo) throw new ConflictException(`La variante ${variante.sku} ya no esta disponible`);
      if (!activados.some((activado) => activado.idProducto === variante.idProducto)) throw new ConflictException(`"${variante.producto.nombre}" no se vende en esta sucursal`);
      const cantidad = cantidades.get(id) as number;
      const precioUnitario = precioConDescuento(Number(variante.producto.precio), Number(variante.producto.descuentoPorcentaje));
      return { idVariante: id, cantidad, precioUnitario, subtotal: redondear(precioUnitario * cantidad) };
    });
  }

  /** Mide todas las variantes bajo bloqueo: el 409 lista cada prenda afectada, no solo la primera. */
  private async validarStock(manager: EntityManager, idSucursal: number, lineas: LineaCompraOffline[]): Promise<void> {
    const almacenes = await manager.getRepository(Almacen).find({ where: { idSucursal, activo: true }, select: { id: true } });
    const afectados: Array<{ id_variante: number; stock_solicitado: number; stock_actual: number }> = [];
    for (const linea of lineas) {
      const inventarios =
        almacenes.length === 0
          ? []
          : await manager.getRepository(Inventario).find({
              where: { idAlmacen: In(almacenes.map((almacen) => almacen.id)), idVarianteProducto: linea.idVariante },
              order: { idAlmacen: 'ASC' },
              lock: { mode: 'pessimistic_write' },
            });
      const actual = inventarios.reduce((suma, inventario) => suma + inventario.stockDisponible, 0);
      if (actual < linea.cantidad) afectados.push({ id_variante: linea.idVariante, stock_solicitado: linea.cantidad, stock_actual: actual });
    }
    if (afectados.length === 0) return;
    const mensaje = 'Tu compra no pudo concretarse porque ya no hay stock suficiente.';
    throw new ConflictException({ message: mensaje, error: 'Conflict', codigo_error: CODIGO_COMPRA_SIN_STOCK, mensaje, items_afectados: afectados });
  }

  /** El carrito pasa a ser exactamente esta compra: el checkout cobra lo que hay en el. */
  private async dejarEnCarrito(manager: EntityManager, idCliente: number, dto: SincronizarCompraOfflineDto, lineas: LineaCompraOffline[]): Promise<void> {
    const carritoRepo = manager.getRepository(Carrito);
    const existente = await carritoRepo.findOne({ where: { idCliente } });
    const carrito = await carritoRepo.save(
      Object.assign(existente ?? carritoRepo.create({ idCliente }), { idSucursal: dto.idSucursal, idLocalOffline: dto.idLocal, fechaActualizacion: new Date() }),
    );

    const detalleRepo = manager.getRepository(DetalleCarrito);
    await detalleRepo.delete({ idCarrito: carrito.id });
    await detalleRepo.save(
      lineas.map((linea) =>
        detalleRepo.create({
          idCarrito: carrito.id,
          idVarianteProducto: linea.idVariante,
          cantidad: linea.cantidad,
          precioUnitario: linea.precioUnitario.toFixed(2),
          subtotal: linea.subtotal.toFixed(2),
        }),
      ),
    );
  }
}

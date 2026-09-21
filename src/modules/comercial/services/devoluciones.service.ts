import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager, type Repository } from 'typeorm';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { Almacen } from '../../inventario/entities/almacen.entity.js';
import { Inventario } from '../../inventario/entities/inventario.entity.js';
import { NotificacionPush } from '../../electronico/entities/notificacion-push.entity.js';
import { Reserva } from '../../electronico/entities/reserva.entity.js';
import { EmpleadoSucursal } from '../../operaciones/entities/empleado-sucursal.entity.js';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';
import { Caja } from '../entities/caja.entity.js';
import { DetalleNotaDevolucion } from '../entities/detalle-nota-devolucion.entity.js';
import { MovimientoCaja } from '../entities/movimiento-caja.entity.js';
import { NotaDevolucion, type TipoDevolucion } from '../entities/nota-devolucion.entity.js';
import { NotaVenta } from '../entities/nota-venta.entity.js';
import { Pago } from '../entities/pago.entity.js';
import { PasarelaPago } from '../entities/pasarela-pago.entity.js';
import { DevolucionRepository } from '../repositories/devolucion.repository.js';
import { toDevolucionResponseDto } from '../mappers/devolucion.mapper.js';
import {
  PLAZO_DEVOLUCION_DIAS,
  type CrearDevolucionDto,
  type DevolucionesPaginatedResponseDto,
  type DevolucionesQueryDto,
  type DevolucionResponseDto,
  type ItemDevolucionDto,
  type OrigenDevolucionQueryDto,
  type OrigenDevolucionResponseDto,
} from '../dto/devoluciones.dto.js';
import type { PaginacionClienteQueryDto } from '../dto/paginacion-cliente-query.dto.js';

/** Valores por defecto de INVENTARIO cuando la devolucion abre el registro de una variante en un almacen. */
const STOCK_MINIMO_INICIAL = 5;
const STOCK_MAXIMO_INICIAL = 500;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function formatearFecha(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function formatearHora(fecha: Date): string {
  return fecha.toTimeString().slice(0, 8);
}

function normalizarCodigo(codigo?: string): string | undefined {
  return codigo?.trim().toUpperCase() || undefined;
}

interface LineaNota {
  idVarianteProducto: number;
  sku: string;
  descripcion: string;
  cantidadComprada: number;
  cantidadDevuelta: number;
  /** Precio por unidad que se devuelve, prorrateado con el descuento e impuesto de la nota. */
  precioReembolsable: number;
}

interface OrigenNota {
  tipo: 'PRODUCTO_ENTREGADO';
  nota: NotaVenta;
  lineas: LineaNota[];
}

interface OrigenReserva {
  tipo: 'CANCELACION_RESERVA';
  reserva: Reserva;
  anticipoPagado: number;
  yaReembolsado: number;
}

type Origen = OrigenNota | OrigenReserva;

/**
 * CU24. Una devolucion nace de una nota de venta pagada (prendas que vuelven) o de una reserva cancelada con
 * anticipo (solo dinero). El reembolso sale como EGRESO de la caja abierta de la sucursal receptora y las
 * prendas aptas para la venta regresan a stock_disponible del almacen elegido.
 */
@Injectable()
export class DevolucionesService {
  constructor(
    private readonly devolucionRepo: DevolucionRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(EmpleadoSucursal) private readonly empleadoSucursalRepo: Repository<EmpleadoSucursal>,
  ) {}

  async listar(query: DevolucionesQueryDto, usuario: ActiveUser): Promise<DevolucionesPaginatedResponseDto> {
    const idsSucursal = await this.sucursalesVisibles(usuario);
    if (idsSucursal && query.idSucursal !== undefined && !idsSucursal.includes(query.idSucursal)) {
      throw new ForbiddenException('No estas asignado a esa sucursal');
    }

    const { items, total } =
      idsSucursal && idsSucursal.length === 0
        ? { items: [], total: 0 }
        : await this.devolucionRepo.findPage({ ...query, idsSucursal });

    return {
      items: items.map(toDevolucionResponseDto),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  /** Devoluciones del cliente autenticado (nunca de otro: el id sale del token). */
  async listarPropias(query: PaginacionClienteQueryDto, usuario: ActiveUser): Promise<DevolucionesPaginatedResponseDto> {
    const { items, total } = await this.devolucionRepo.findPage({
      page: query.page,
      limit: query.limit,
      idCliente: this.idCliente(usuario),
    });
    return {
      items: items.map(toDevolucionResponseDto),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async obtenerPropia(id: number, usuario: ActiveUser): Promise<DevolucionResponseDto> {
    const devolucion = await this.devolucionRepo.findByIdConDetalle(id);
    if (!devolucion || devolucion.idCliente !== this.idCliente(usuario)) throw new NotFoundException('Devolucion no encontrada');
    return toDevolucionResponseDto(devolucion);
  }

  private idCliente(usuario: ActiveUser): number {
    if (usuario.tipoUsuario !== 'C') throw new ForbiddenException('Solo los clientes tienen devoluciones propias');
    return usuario.sub;
  }

  async obtener(id: number, usuario: ActiveUser): Promise<DevolucionResponseDto> {
    const devolucion = await this.devolucionRepo.findByIdConDetalle(id);
    if (!devolucion) throw new NotFoundException('Devolucion no encontrada');
    await this.validarAccesoSucursal(usuario, devolucion.idSucursal);
    return toDevolucionResponseDto(devolucion);
  }

  /** A. Busca la nota o reserva por su codigo y dice que se puede devolver todavia. */
  async buscarOrigen(query: OrigenDevolucionQueryDto): Promise<OrigenDevolucionResponseDto> {
    const origen = await this.resolverOrigen(this.dataSource.manager, query.codigoNota, query.codigoReserva, false);
    return this.toOrigenResponse(origen);
  }

  async crear(dto: CrearDevolucionDto, usuario: ActiveUser): Promise<DevolucionResponseDto> {
    const idSucursal = usuario.tipoUsuario === 'E' ? usuario.sucursalId : dto.idSucursal;
    if (!idSucursal) throw new BadRequestException('Indica la sucursal que recibe la devolucion');
    if (dto.autorizarFueraDePlazo && usuario.tipoUsuario !== 'A') {
      throw new ForbiddenException('Solo el administrador puede autorizar una devolucion fuera de plazo');
    }

    const idDevolucion = await this.dataSource.transaction(async (manager) => {
      const sucursal = await manager.getRepository(Sucursal).findOne({ where: { id: idSucursal } });
      if (!sucursal) throw new NotFoundException('Sucursal no encontrada');
      if (!sucursal.activo) throw new ConflictException('La sucursal esta inactiva');
      await this.validarAccesoSucursal(usuario, idSucursal);

      const origen = await this.resolverOrigen(manager, dto.codigoNota, dto.codigoReserva, true);
      this.validarMotivo(origen.tipo, dto.motivoDevolucion);
      if (origen.tipo === 'PRODUCTO_ENTREGADO' && !this.dentroDePlazo(origen.nota) && !dto.autorizarFueraDePlazo) {
        throw new ConflictException(
          `Pasaron mas de ${PLAZO_DEVOLUCION_DIAS} dias desde la venta; el administrador debe autorizar la devolucion`,
        );
      }

      const caja = await manager.getRepository(Caja).findOne({ where: { idSucursal, estado: 'Abierta' } });
      if (!caja) throw new ConflictException('La sucursal no tiene una caja abierta para entregar el reembolso');
      const idCajero = await this.resolverCajero(manager, usuario, dto.idCajero ?? caja.idCajero, idSucursal);
      if (dto.idPasarela !== undefined) await this.validarPasarelaPresencial(manager, dto.idPasarela);

      const lineas =
        origen.tipo === 'PRODUCTO_ENTREGADO'
          ? await this.construirLineasProducto(manager, origen, dto.items ?? [], idSucursal)
          : this.construirLineaReserva(origen);
      const total = redondear(lineas.reduce((suma, linea) => suma + linea.montoSubtotal, 0));

      const ahora = new Date();
      const referencia = origen.tipo === 'PRODUCTO_ENTREGADO' ? origen.nota.codigoNota : origen.reserva.codigoReserva;
      const movimientoRepo = manager.getRepository(MovimientoCaja);
      const movimiento = await movimientoRepo.save(
        movimientoRepo.create({
          idCaja: caja.id,
          tipo: 'EGRESO',
          concepto: `Reembolso devolucion ${referencia}`.slice(0, 150),
          monto: total.toFixed(2),
          observaciones: null,
          fechaHora: ahora,
        }),
      );

      const notaRepo = manager.getRepository(NotaDevolucion);
      const cliente = origen.tipo === 'PRODUCTO_ENTREGADO' ? origen.nota : origen.reserva;
      const devolucion = await notaRepo.save(
        notaRepo.create({
          codigoDevolucion: `TMP-${randomSufijo()}`,
          idCliente: cliente.idCliente,
          idSucursal,
          idCajero,
          idNotaVenta: origen.tipo === 'PRODUCTO_ENTREGADO' ? origen.nota.id : null,
          idReserva: origen.tipo === 'CANCELACION_RESERVA' ? origen.reserva.id : null,
          idMovimientoCaja: movimiento.id,
          tipoDevolucion: origen.tipo,
          motivoDevolucion: dto.motivoDevolucion,
          montoTotalReembolsado: total,
          observaciones: dto.observaciones?.trim() || null,
          fechaEmision: ahora,
        }),
      );
      devolucion.codigoDevolucion = `DV-${String(devolucion.id).padStart(6, '0')}`;
      await notaRepo.save(devolucion);

      const detalleRepo = manager.getRepository(DetalleNotaDevolucion);
      await detalleRepo.save(lineas.map((linea) => detalleRepo.create({ ...linea, idNotaDevolucion: devolucion.id })));

      await this.reingresarStock(manager, lineas);

      if (total > 0) {
        const pagoRepo = manager.getRepository(Pago);
        await pagoRepo.save(
          pagoRepo.create({
            idMovimientoCaja: movimiento.id,
            idPasarela: dto.idPasarela ?? null,
            idNotaVenta: origen.tipo === 'PRODUCTO_ENTREGADO' ? origen.nota.id : null,
            idReserva: origen.tipo === 'CANCELACION_RESERVA' ? origen.reserva.id : null,
            monto: total,
            concepto: 'REEMBOLSO',
            fechaPago: formatearFecha(ahora),
            horaPago: formatearHora(ahora),
          }),
        );
      }

      if (origen.tipo === 'PRODUCTO_ENTREGADO' && origen.nota.tipoVenta === 'E_COMMERCE') {
        const notificacionRepo = manager.getRepository(NotificacionPush);
        await notificacionRepo.save(
          notificacionRepo.create({
            idUsuario: origen.nota.idCliente,
            titulo: 'Reembolso registrado',
            mensaje: `Registramos la devolucion ${devolucion.codigoDevolucion} de tu compra ${origen.nota.codigoNota}. Reembolso: Bs ${total.toFixed(2)}.`,
          }),
        );
      }

      return devolucion.id;
    });

    return this.obtener(idDevolucion, usuario);
  }

  /** Carga la nota o reserva de origen; con `bloquear` toma un lock para que dos devoluciones simultaneas no excedan lo comprado. */
  private async resolverOrigen(manager: EntityManager, codigoNota?: string, codigoReserva?: string, bloquear = false): Promise<Origen> {
    const notaCodigo = normalizarCodigo(codigoNota);
    const reservaCodigo = normalizarCodigo(codigoReserva);
    if (!notaCodigo === !reservaCodigo) {
      throw new BadRequestException('Indica el codigo de la nota de venta o el de la reserva (solo uno)');
    }

    if (notaCodigo) {
      const nota = await manager.getRepository(NotaVenta).findOne({
        where: { codigoNota: notaCodigo },
        relations: { cliente: { usuario: true }, sucursal: true, detalles: { variante: true } },
      });
      if (!nota) throw new NotFoundException('Nota de venta no encontrada');
      if (nota.estadoPago !== 'Pagado') throw new ConflictException('La nota de venta no esta pagada');
      if (bloquear) await manager.getRepository(NotaVenta).findOne({ where: { id: nota.id }, lock: { mode: 'pessimistic_write' } });

      const devueltas = await this.devolucionRepo.unidadesDevueltasPorVariante(nota.id, manager);
      return { tipo: 'PRODUCTO_ENTREGADO', nota, lineas: this.agruparLineas(nota, devueltas) };
    }

    const reserva = await manager.getRepository(Reserva).findOne({
      where: { codigoReserva: reservaCodigo },
      relations: { cliente: { usuario: true }, sucursal: true },
    });
    if (!reserva) throw new NotFoundException('Reserva no encontrada');
    if (reserva.estado !== 'CANCELADA') {
      throw new ConflictException('Solo se devuelve el anticipo de una reserva cancelada; cancela la reserva primero');
    }
    if (bloquear) await manager.getRepository(Reserva).findOne({ where: { id: reserva.id }, lock: { mode: 'pessimistic_write' } });

    const anticipos = await manager.getRepository(Pago).find({ where: { idReserva: reserva.id, concepto: 'ANTICIPO_RESERVA' } });
    const anticipoPagado = redondear(anticipos.reduce((suma, pago) => suma + Number(pago.monto), 0));
    const yaReembolsado = redondear(await this.devolucionRepo.montoReembolsadoDeReserva(reserva.id, manager));
    return { tipo: 'CANCELACION_RESERVA', reserva, anticipoPagado, yaReembolsado };
  }

  /** Suma las lineas repetidas de una misma variante y prorratea descuento/impuesto de la nota en el precio. */
  private agruparLineas(nota: NotaVenta, devueltas: Map<number, number>): LineaNota[] {
    const factor = Number(nota.subtotal) > 0 ? Number(nota.montoTotal) / Number(nota.subtotal) : 1;
    const porVariante = new Map<number, { sku: string; descripcion: string; cantidad: number; importe: number }>();

    for (const detalle of nota.detalles ?? []) {
      if (detalle.idVarianteProducto === null) continue;
      const acumulado = porVariante.get(detalle.idVarianteProducto) ?? {
        sku: detalle.variante?.sku ?? '',
        descripcion: detalle.descripcion,
        cantidad: 0,
        importe: 0,
      };
      acumulado.cantidad += detalle.cantidad;
      acumulado.importe += Number(detalle.subtotal);
      porVariante.set(detalle.idVarianteProducto, acumulado);
    }

    return [...porVariante.entries()].map(([idVarianteProducto, linea]) => ({
      idVarianteProducto,
      sku: linea.sku,
      descripcion: linea.descripcion,
      cantidadComprada: linea.cantidad,
      cantidadDevuelta: devueltas.get(idVarianteProducto) ?? 0,
      precioReembolsable: redondear((linea.importe * factor) / linea.cantidad),
    }));
  }

  private toOrigenResponse(origen: Origen): OrigenDevolucionResponseDto {
    if (origen.tipo === 'CANCELACION_RESERVA') {
      const { reserva } = origen;
      const usuario = reserva.cliente?.usuario;
      return {
        tipoDevolucion: origen.tipo,
        idNotaVenta: null,
        idReserva: reserva.id,
        codigo: reserva.codigoReserva,
        idCliente: reserva.idCliente,
        clienteNombre: usuario ? `${usuario.nombre} ${usuario.apellido}`.trim() : '',
        idSucursal: reserva.idSucursal,
        sucursalNombre: reserva.sucursal?.nombre ?? '',
        fecha: reserva.fechaReserva.toISOString(),
        plazoDias: PLAZO_DEVOLUCION_DIAS,
        dentroDePlazo: true,
        montoReembolsable: Math.max(0, redondear(origen.anticipoPagado - origen.yaReembolsado)),
        lineas: [],
      };
    }

    const { nota } = origen;
    const usuario = nota.cliente?.usuario;
    const lineas = origen.lineas.map((linea) => ({
      idVarianteProducto: linea.idVarianteProducto,
      sku: linea.sku,
      descripcion: linea.descripcion,
      precioReembolsable: linea.precioReembolsable,
      cantidadComprada: linea.cantidadComprada,
      cantidadDevuelta: linea.cantidadDevuelta,
      cantidadDisponible: Math.max(0, linea.cantidadComprada - linea.cantidadDevuelta),
    }));

    return {
      tipoDevolucion: origen.tipo,
      idNotaVenta: nota.id,
      idReserva: null,
      codigo: nota.codigoNota,
      idCliente: nota.idCliente,
      clienteNombre: usuario ? `${usuario.nombre} ${usuario.apellido}`.trim() : '',
      idSucursal: nota.idSucursal,
      sucursalNombre: nota.sucursal?.nombre ?? '',
      fecha: this.fechaEmision(nota).toISOString(),
      plazoDias: PLAZO_DEVOLUCION_DIAS,
      dentroDePlazo: this.dentroDePlazo(nota),
      montoReembolsable: redondear(lineas.reduce((suma, linea) => suma + linea.precioReembolsable * linea.cantidadDisponible, 0)),
      lineas,
    };
  }

  private fechaEmision(nota: NotaVenta): Date {
    return new Date(`${nota.fechaEmision}T${nota.horaEmision}`);
  }

  private dentroDePlazo(nota: NotaVenta): boolean {
    return Date.now() - this.fechaEmision(nota).getTime() <= PLAZO_DEVOLUCION_DIAS * MS_POR_DIA;
  }

  private validarMotivo(tipo: TipoDevolucion, motivo: CrearDevolucionDto['motivoDevolucion']): void {
    if (tipo === 'CANCELACION_RESERVA' && motivo !== 'CANCELACION') {
      throw new BadRequestException('La devolucion de una reserva cancelada lleva el motivo CANCELACION');
    }
    if (tipo === 'PRODUCTO_ENTREGADO' && motivo === 'CANCELACION') {
      throw new BadRequestException('El motivo CANCELACION es solo para reservas; elige falla, talla o arrepentimiento');
    }
  }

  /** B. Valida cada prenda contra lo comprado y decide su destino fisico. */
  private async construirLineasProducto(
    manager: EntityManager,
    origen: OrigenNota,
    items: ItemDevolucionDto[],
    idSucursal: number,
  ): Promise<LineaDevolucion[]> {
    if (items.length === 0) throw new BadRequestException('Selecciona al menos una prenda a devolver');

    const pedidas = new Map<number, number>();
    for (const item of items) pedidas.set(item.idVarianteProducto, (pedidas.get(item.idVarianteProducto) ?? 0) + item.cantidad);
    for (const [idVariante, cantidad] of pedidas) {
      const linea = origen.lineas.find((candidata) => candidata.idVarianteProducto === idVariante);
      if (!linea) throw new BadRequestException(`La variante ${idVariante} no forma parte de la nota ${origen.nota.codigoNota}`);
      const disponible = linea.cantidadComprada - linea.cantidadDevuelta;
      if (cantidad > disponible) {
        throw new BadRequestException(
          `Solo quedan ${disponible} unidad(es) por devolver de "${linea.descripcion}" (compradas ${linea.cantidadComprada}, ya devueltas ${linea.cantidadDevuelta})`,
        );
      }
    }

    const almacenes = new Map<number, Almacen>();
    for (const item of items) {
      if (item.estadoProducto === 'REINGRESO_INVENTARIO' && item.idAlmacen === undefined) {
        throw new BadRequestException('Elige el almacen que recibe las prendas que vuelven al inventario');
      }
      if (item.idAlmacen !== undefined && !almacenes.has(item.idAlmacen)) {
        const almacen = await manager.getRepository(Almacen).findOne({ where: { id: item.idAlmacen } });
        if (!almacen) throw new NotFoundException(`Almacen ${item.idAlmacen} no encontrado`);
        if (!almacen.activo) throw new ConflictException(`El almacen "${almacen.nombre}" esta inactivo`);
        if (almacen.idSucursal !== idSucursal) {
          throw new BadRequestException(`El almacen "${almacen.nombre}" no pertenece a la sucursal que recibe la devolucion`);
        }
        almacenes.set(almacen.id, almacen);
      }
    }

    return items.map((item) => {
      const linea = origen.lineas.find((candidata) => candidata.idVarianteProducto === item.idVarianteProducto) as LineaNota;
      return {
        idVarianteProducto: item.idVarianteProducto,
        idAlmacen: item.idAlmacen ?? null,
        descripcion: linea.descripcion.slice(0, 255),
        precioUnitario: linea.precioReembolsable,
        cantidad: item.cantidad,
        montoSubtotal: redondear(linea.precioReembolsable * item.cantidad),
        estadoProducto: item.estadoProducto,
      };
    });
  }

  /** La prenda nunca salio de la tienda: solo se devuelve el anticipo pendiente de reembolsar. */
  private construirLineaReserva(origen: OrigenReserva): LineaDevolucion[] {
    const pendiente = redondear(origen.anticipoPagado - origen.yaReembolsado);
    if (pendiente <= 0) throw new ConflictException('La reserva no tiene anticipo pendiente de devolver');
    return [
      {
        idVarianteProducto: null,
        idAlmacen: null,
        descripcion: `Reembolso del anticipo de la reserva ${origen.reserva.codigoReserva}`.slice(0, 255),
        precioUnitario: pendiente,
        cantidad: 1,
        montoSubtotal: pendiente,
        estadoProducto: 'NO_APLICA',
      },
    ];
  }

  /** Solo las prendas en estado REINGRESO_INVENTARIO vuelven a stock_disponible; la merma no toca el stock vendible. */
  private async reingresarStock(manager: EntityManager, lineas: LineaDevolucion[]): Promise<void> {
    const inventarioRepo = manager.getRepository(Inventario);
    // Orden fijo para que devoluciones simultaneas bloqueen las filas en el mismo orden y no se interbloqueen.
    const reingresos = lineas
      .filter((linea) => linea.estadoProducto === 'REINGRESO_INVENTARIO' && linea.idAlmacen !== null && linea.idVarianteProducto !== null)
      .sort((a, b) => (a.idAlmacen as number) - (b.idAlmacen as number) || (a.idVarianteProducto as number) - (b.idVarianteProducto as number));

    for (const linea of reingresos) {
      const existente = await inventarioRepo.findOne({
        where: { idAlmacen: linea.idAlmacen as number, idVarianteProducto: linea.idVarianteProducto as number },
        lock: { mode: 'pessimistic_write' },
      });
      if (existente) {
        existente.stockDisponible += linea.cantidad;
        await inventarioRepo.save(existente);
      } else {
        await inventarioRepo.save(
          inventarioRepo.create({
            idAlmacen: linea.idAlmacen as number,
            idVarianteProducto: linea.idVarianteProducto as number,
            stockDisponible: linea.cantidad,
            stockReservado: 0,
            stockMinimo: STOCK_MINIMO_INICIAL,
            stockMaximo: STOCK_MAXIMO_INICIAL,
          }),
        );
      }
    }
  }

  /**
   * id_cajero es obligatorio. Un empleado firma con su propio id; el administrador no tiene legajo, asi que
   * indica un cajero (o se usa el de la caja abierta) y este debe estar asignado a la sucursal receptora.
   */
  private async resolverCajero(
    manager: EntityManager,
    usuario: ActiveUser,
    idCajero: number | null | undefined,
    idSucursal: number,
  ): Promise<number> {
    if (usuario.tipoUsuario === 'E') return usuario.sub;
    if (!idCajero) throw new BadRequestException('Indica el cajero responsable de la devolucion');
    const asignacion = await manager.getRepository(EmpleadoSucursal).findOne({ where: { idEmpleado: idCajero, idSucursal, activo: true } });
    if (!asignacion) throw new BadRequestException('El cajero indicado no esta asignado a la sucursal que recibe la devolucion');
    return idCajero;
  }

  private async validarPasarelaPresencial(manager: EntityManager, idPasarela: number): Promise<void> {
    const pasarela = await manager.getRepository(PasarelaPago).findOne({ where: { id: idPasarela } });
    if (!pasarela) throw new NotFoundException('Metodo de pago no encontrado');
    if (!pasarela.disponiblePresencial) throw new BadRequestException('El metodo de pago no esta habilitado para caja');
  }

  /** `undefined` = sin restriccion (administrador); un empleado solo ve las sucursales que tiene asignadas. */
  private async sucursalesVisibles(usuario: ActiveUser): Promise<number[] | undefined> {
    if (usuario.tipoUsuario !== 'E') return undefined;
    const asignaciones = await this.empleadoSucursalRepo.find({ where: { idEmpleado: usuario.sub, activo: true } });
    return asignaciones.map((asignacion) => asignacion.idSucursal);
  }

  private async validarAccesoSucursal(usuario: ActiveUser, idSucursal: number): Promise<void> {
    const visibles = await this.sucursalesVisibles(usuario);
    if (visibles && !visibles.includes(idSucursal)) {
      throw new ForbiddenException('No estas asignado a la sucursal de esta devolucion');
    }
  }
}

interface LineaDevolucion {
  idVarianteProducto: number | null;
  idAlmacen: number | null;
  descripcion: string;
  precioUnitario: number;
  cantidad: number;
  montoSubtotal: number;
  estadoProducto: 'REINGRESO_INVENTARIO' | 'MERMA_DEFECTUOSO' | 'NO_APLICA';
}

/** Sufijo aleatorio de 16 caracteres para el codigo provisorio (el definitivo usa el id de la fila). */
function randomSufijo(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}

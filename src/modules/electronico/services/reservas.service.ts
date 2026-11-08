import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, In, type EntityManager, type Repository } from 'typeorm';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { Almacen } from '../../inventario/entities/almacen.entity.js';
import { Inventario } from '../../inventario/entities/inventario.entity.js';
import { ProductoSucursal } from '../../inventario/entities/producto-sucursal.entity.js';
import { VarianteProducto } from '../../inventario/entities/variante-producto.entity.js';
import { precioConDescuento } from '../../inventario/utils/precio.util.js';
import { Caja } from '../../comercial/entities/caja.entity.js';
import { DetalleNotaVenta } from '../../comercial/entities/detalle-nota-venta.entity.js';
import { MovimientoCaja } from '../../comercial/entities/movimiento-caja.entity.js';
import { NotaVenta } from '../../comercial/entities/nota-venta.entity.js';
import { Pago } from '../../comercial/entities/pago.entity.js';
import { PasarelaPago } from '../../comercial/entities/pasarela-pago.entity.js';
import { Cliente } from '../../operaciones/entities/cliente.entity.js';
import { EmpleadoSucursal } from '../../operaciones/entities/empleado-sucursal.entity.js';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';
import { DetalleReserva } from '../entities/detalle-reserva.entity.js';
import { Reserva } from '../entities/reserva.entity.js';
import { ReservaRepository } from '../repositories/reserva.repository.js';
import { toReservaResponseDto } from '../mappers/reserva.mapper.js';
import {
  HORAS_LIMITE_POR_DEFECTO,
  PORCENTAJE_ANTICIPO_MINIMO,
  type CancelarReservaDto,
  type CrearReservaDto,
  type LiquidarReservaDto,
  type RegistrarAnticipoDto,
  type ReservaResponseDto,
  type ReservasPaginatedResponseDto,
  type ReservasQueryDto,
} from '../dto/reservas.dto.js';

/** Un cliente no puede acaparar stock: como maximo tiene este numero de reservas vivas a la vez. */
export const MAX_RESERVAS_ACTIVAS_CLIENTE = 3;
const INTERVALO_VENCIMIENTO_MS = 5 * 60 * 1000;

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

/** Codigo provisorio (<= 20 caracteres) mientras se conoce el id de la fila; evita carreras por conteo. */
function codigoProvisional(): string {
  return `TMP-${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function codigoDefinitivo(prefijo: string, id: number): string {
  return `${prefijo}-${String(id).padStart(6, '0')}`;
}

interface LineaReserva {
  variante: VarianteProducto;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

/**
 * CU23. El stock apartado sale de INVENTARIO.stock_disponible hacia stock_reservado. DETALLE_RESERVA no
 * guarda almacen, asi que la asignacion entre los almacenes de la sucursal es voraz (por id de almacen): los
 * totales por sucursal y variante siempre cuadran aunque el reparto exacto entre almacenes no se conserve.
 */
@Injectable()
export class ReservasService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReservasService.name);
  private temporizador?: NodeJS.Timeout;

  constructor(
    private readonly reservaRepo: ReservaRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Sucursal) private readonly sucursalRepo: Repository<Sucursal>,
    @InjectRepository(EmpleadoSucursal) private readonly empleadoSucursalRepo: Repository<EmpleadoSucursal>,
  ) {}

  onModuleInit(): void {
    this.temporizador = setInterval(() => void this.vencerVencidasSeguro(), INTERVALO_VENCIMIENTO_MS);
    this.temporizador.unref();
  }

  onModuleDestroy(): void {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  async listar(query: ReservasQueryDto, usuario: ActiveUser): Promise<ReservasPaginatedResponseDto> {
    await this.vencerVencidasSeguro();

    const idsSucursal = await this.sucursalesVisibles(usuario);
    if (idsSucursal && query.idSucursal !== undefined && !idsSucursal.includes(query.idSucursal)) {
      throw new ForbiddenException('No estas asignado a esa sucursal');
    }

    const { items, total } =
      idsSucursal && idsSucursal.length === 0
        ? { items: [], total: 0 }
        : await this.reservaRepo.findPage({ ...query, idsSucursal });

    return {
      items: items.map((reserva) => toReservaResponseDto(reserva, { incluirDetalles: false })),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async misReservas(usuario: ActiveUser): Promise<ReservaResponseDto[]> {
    const idCliente = this.idCliente(usuario);
    await this.vencerVencidasSeguro();
    const reservas = await this.reservaRepo.findByCliente(idCliente);
    return reservas.map((reserva) => toReservaResponseDto(reserva));
  }

  /** Las rutas "mias" no llevan permiso: aqui se exige que quien llama sea cliente para que el personal no las use de atajo. */
  async crearPropia(dto: CrearReservaDto, usuario: ActiveUser): Promise<ReservaResponseDto> {
    this.idCliente(usuario);
    return this.crear(dto, usuario);
  }

  async obtenerPropia(id: number, usuario: ActiveUser): Promise<ReservaResponseDto> {
    this.idCliente(usuario);
    return this.obtener(id, usuario);
  }

  async cancelarPropia(id: number, dto: CancelarReservaDto, usuario: ActiveUser): Promise<ReservaResponseDto> {
    this.idCliente(usuario);
    return this.cancelar(id, dto, usuario);
  }

  async obtener(id: number, usuario: ActiveUser): Promise<ReservaResponseDto> {
    const reserva = await this.reservaRepo.findByIdConDetalle(id);
    if (!reserva) throw new NotFoundException('Reserva no encontrada');
    if (usuario.tipoUsuario === 'C') {
      // Un cliente nunca debe poder distinguir una reserva ajena de una inexistente.
      if (reserva.idCliente !== usuario.sub) throw new NotFoundException('Reserva no encontrada');
    } else {
      await this.validarAccesoSucursal(usuario, reserva.idSucursal);
    }
    const notaVenta = reserva.estado === 'COMPLETADA' ? await this.reservaRepo.findNotaVenta(reserva.id) : null;
    return toReservaResponseDto(reserva, { notaVenta });
  }

  /** A. Crear reserva: aparta el stock y deja la reserva PENDIENTE hasta que se cobre el anticipo. */
  async crear(dto: CrearReservaDto, usuario: ActiveUser): Promise<ReservaResponseDto> {
    const esCliente = usuario.tipoUsuario === 'C';
    const idCliente = esCliente ? usuario.sub : dto.idCliente;
    if (!idCliente) throw new BadRequestException('Indica el cliente de la reserva');
    const idSucursal = usuario.tipoUsuario === 'E' ? usuario.sucursalId : dto.idSucursal;
    if (!idSucursal) throw new BadRequestException('Indica la sucursal de la reserva');

    const items = consolidarItems(dto.items);

    const idReserva = await this.dataSource.transaction(async (manager) => {
      const cliente = await manager.getRepository(Cliente).findOne({ where: { idUsuario: idCliente } });
      if (!cliente) throw new NotFoundException('Cliente no encontrado');

      const sucursal = await manager.getRepository(Sucursal).findOne({ where: { id: idSucursal } });
      if (!sucursal) throw new NotFoundException('Sucursal no encontrada');
      if (!sucursal.activo) throw new ConflictException('La sucursal esta inactiva');
      if (usuario.tipoUsuario === 'E') await this.validarAccesoSucursal(usuario, idSucursal);

      if (esCliente) {
        const activas = await manager.getRepository(Reserva).count({
          where: { idCliente, estado: In(['PENDIENTE', 'PAGADA']) },
        });
        if (activas >= MAX_RESERVAS_ACTIVAS_CLIENTE) {
          throw new ConflictException(
            `Ya tienes ${MAX_RESERVAS_ACTIVAS_CLIENTE} reservas activas; completa o cancela alguna antes de reservar de nuevo`,
          );
        }
      }

      const lineas = await this.construirLineas(manager, idSucursal, items);
      const montoTotal = redondear(lineas.reduce((suma, linea) => suma + linea.subtotal, 0));
      const anticipoMinimo = redondear((montoTotal * PORCENTAJE_ANTICIPO_MINIMO) / 100);
      const montoAnticipo = redondear(dto.montoAnticipo ?? anticipoMinimo);
      if (montoAnticipo < anticipoMinimo) {
        throw new BadRequestException(`El anticipo minimo es Bs ${anticipoMinimo.toFixed(2)} (${PORCENTAJE_ANTICIPO_MINIMO}% del total)`);
      }
      if (montoAnticipo > montoTotal) throw new BadRequestException('El anticipo no puede superar el total de la reserva');

      for (const linea of lineas) {
        await this.apartarStock(manager, idSucursal, linea);
      }

      const ahora = new Date();
      const horas = dto.horasLimite ?? HORAS_LIMITE_POR_DEFECTO;
      const reservaRepo = manager.getRepository(Reserva);
      const reserva = await reservaRepo.save(
        reservaRepo.create({
          codigoReserva: codigoProvisional(),
          idCliente,
          idSucursal,
          fechaReserva: ahora,
          fechaLimite: new Date(ahora.getTime() + horas * 60 * 60 * 1000),
          estado: 'PENDIENTE',
          montoAnticipo,
          montoTotal,
          observaciones: dto.observaciones?.trim() || null,
        }),
      );
      reserva.codigoReserva = codigoDefinitivo('RS', reserva.id);
      await reservaRepo.save(reserva);

      const detalleRepo = manager.getRepository(DetalleReserva);
      await detalleRepo.save(
        lineas.map((linea) =>
          detalleRepo.create({
            idReserva: reserva.id,
            idVarianteProducto: linea.variante.id,
            precioUnitario: linea.precioUnitario,
            cantidad: linea.cantidad,
            subtotal: linea.subtotal,
          }),
        ),
      );

      return reserva.id;
    });

    return this.obtener(idReserva, usuario);
  }

  /** B. Cobra el anticipo en caja: INGRESO + PAGO(ANTICIPO_RESERVA) y la reserva pasa a PAGADA. */
  async registrarAnticipo(id: number, dto: RegistrarAnticipoDto, usuario: ActiveUser): Promise<ReservaResponseDto> {
    await this.vencerVencidasSeguro();

    await this.dataSource.transaction(async (manager) => {
      const reserva = await this.bloquear(manager, id);
      await this.validarAccesoSucursal(usuario, reserva.idSucursal);
      if (reserva.estado !== 'PENDIENTE') {
        throw new ConflictException(
          reserva.estado === 'PAGADA' ? 'El anticipo de esta reserva ya fue cobrado' : `La reserva esta ${reserva.estado.toLowerCase()}`,
        );
      }
      this.validarVigente(reserva);

      const monto = Number(reserva.montoAnticipo);
      if (monto > 0) {
        const caja = await this.obtenerCajaAbierta(manager, reserva.idSucursal);
        await this.validarPasarelaPresencial(manager, dto.idPasarela);
        const ahora = new Date();
        const movimiento = await this.registrarIngreso(manager, caja, `Anticipo reserva ${reserva.codigoReserva}`, monto, ahora);
        await manager.getRepository(Pago).save(
          manager.getRepository(Pago).create({
            idMovimientoCaja: movimiento.id,
            idPasarela: dto.idPasarela,
            idNotaVenta: null,
            idReserva: reserva.id,
            monto,
            concepto: 'ANTICIPO_RESERVA',
            fechaPago: formatearFecha(ahora),
            horaPago: formatearHora(ahora),
          }),
        );
      }

      reserva.estado = 'PAGADA';
      await manager.getRepository(Reserva).save(reserva);
    });

    return this.obtener(id, usuario);
  }

  /** C. Cobra el saldo, emite la nota de venta PRESENCIAL_LIQUIDACION y consume el stock reservado. */
  async liquidar(id: number, dto: LiquidarReservaDto, usuario: ActiveUser): Promise<ReservaResponseDto> {
    await this.vencerVencidasSeguro();

    await this.dataSource.transaction(async (manager) => {
      const reserva = await this.bloquear(manager, id);
      await this.validarAccesoSucursal(usuario, reserva.idSucursal);
      if (reserva.estado !== 'PENDIENTE' && reserva.estado !== 'PAGADA') {
        throw new ConflictException(`La reserva esta ${reserva.estado.toLowerCase()} y no se puede liquidar`);
      }
      this.validarVigente(reserva);

      const detalles = await manager.getRepository(DetalleReserva).find({
        where: { idReserva: reserva.id },
        relations: { variante: { producto: true } },
        order: { id: 'ASC' },
      });
      const anticipos = await manager.getRepository(Pago).find({ where: { idReserva: reserva.id, concepto: 'ANTICIPO_RESERVA' } });
      const anticipoPagado = redondear(anticipos.reduce((suma, pago) => suma + Number(pago.monto), 0));
      const montoTotal = Number(reserva.montoTotal);
      const saldo = Math.max(0, redondear(montoTotal - anticipoPagado));

      const ahora = new Date();
      let movimiento: MovimientoCaja | null = null;
      if (saldo > 0) {
        if (!dto.idPasarela) throw new BadRequestException('Elige el metodo de pago con el que se cobra el saldo');
        const caja = await this.obtenerCajaAbierta(manager, reserva.idSucursal);
        await this.validarPasarelaPresencial(manager, dto.idPasarela);
        movimiento = await this.registrarIngreso(manager, caja, `Saldo reserva ${reserva.codigoReserva}`, saldo, ahora);
      }

      const notaRepo = manager.getRepository(NotaVenta);
      const nota = await notaRepo.save(
        notaRepo.create({
          codigoNota: codigoProvisional(),
          idCliente: reserva.idCliente,
          idCajero: usuario.tipoUsuario === 'E' ? usuario.sub : null,
          idSucursal: reserva.idSucursal,
          idPasarela: saldo > 0 ? (dto.idPasarela ?? null) : null,
          idMovimientoCaja: movimiento?.id ?? null,
          idCarrito: null,
          idReserva: reserva.id,
          tipo: 'PRESENCIAL',
          tipoVenta: 'PRESENCIAL_LIQUIDACION',
          nroFactura: dto.nroFactura?.trim() || null,
          nitRazonSocial: dto.nitRazonSocial?.trim() || null,
          fechaEmision: formatearFecha(ahora),
          horaEmision: formatearHora(ahora),
          subtotal: montoTotal,
          montoAnticipoAplicado: anticipoPagado,
          descuento: 0,
          impuesto: 0,
          montoTotal,
          estadoPago: 'Pagado',
        }),
      );
      nota.codigoNota = codigoDefinitivo('NV', nota.id);
      await notaRepo.save(nota);

      const detalleNotaRepo = manager.getRepository(DetalleNotaVenta);
      await detalleNotaRepo.save(
        detalles.map((detalle) =>
          detalleNotaRepo.create({
            idNotaVenta: nota.id,
            idVarianteProducto: detalle.idVarianteProducto,
            descripcion: `${detalle.variante?.producto?.nombre ?? 'Producto'} (${detalle.variante?.talla}/${detalle.variante?.color})`.slice(0, 255),
            precioUnitario: Number(detalle.precioUnitario),
            cantidad: detalle.cantidad,
            subtotal: Number(detalle.subtotal),
          }),
        ),
      );

      // stock_disponible ya se descontó al reservar: aqui solo sale de lo reservado.
      for (const detalle of [...detalles].sort((a, b) => a.idVarianteProducto - b.idVarianteProducto)) {
        await this.moverStockReservado(manager, reserva.idSucursal, detalle.idVarianteProducto, detalle.cantidad, false);
      }

      if (movimiento) {
        await manager.getRepository(Pago).save(
          manager.getRepository(Pago).create({
            idMovimientoCaja: movimiento.id,
            idPasarela: dto.idPasarela ?? null,
            idNotaVenta: nota.id,
            idReserva: reserva.id,
            monto: saldo,
            concepto: 'SALDO_LIQUIDACION',
            fechaPago: formatearFecha(ahora),
            horaPago: formatearHora(ahora),
          }),
        );
      }

      reserva.estado = 'COMPLETADA';
      await manager.getRepository(Reserva).save(reserva);
    });

    return this.obtener(id, usuario);
  }

  /**
   * D. Cancelacion manual: libera el stock. El anticipo ya cobrado se retiene (no se devuelve aqui); si la
   * politica permite reembolsarlo se gestiona como devolucion CANCELACION_RESERVA (CU24).
   */
  async cancelar(id: number, dto: CancelarReservaDto, usuario: ActiveUser): Promise<ReservaResponseDto> {
    await this.dataSource.transaction(async (manager) => {
      const reserva = await this.bloquear(manager, id);
      if (usuario.tipoUsuario === 'C') {
        if (reserva.idCliente !== usuario.sub) throw new NotFoundException('Reserva no encontrada');
      } else {
        await this.validarAccesoSucursal(usuario, reserva.idSucursal);
      }
      if (reserva.estado !== 'PENDIENTE' && reserva.estado !== 'PAGADA') {
        throw new ConflictException(`La reserva ya esta ${reserva.estado.toLowerCase()}`);
      }
      await this.liberarReserva(manager, reserva, dto.motivo?.trim() || 'Cancelada manualmente');
    });

    return this.obtener(id, usuario);
  }

  /** Cancela las reservas cuya fecha limite ya paso y devuelve el stock apartado. Devuelve cuantas cancelo. */
  async vencerVencidas(): Promise<number> {
    const ids = await this.reservaRepo.findIdsVencidas(new Date());
    let canceladas = 0;
    for (const id of ids) {
      const cancelada = await this.dataSource.transaction(async (manager) => {
        const reserva = await manager.getRepository(Reserva).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
        // Pudo cambiar (liquidarse/cancelarse) entre la consulta y el bloqueo.
        if (!reserva || (reserva.estado !== 'PENDIENTE' && reserva.estado !== 'PAGADA') || reserva.fechaLimite >= new Date()) {
          return false;
        }
        await this.liberarReserva(manager, reserva, 'Cancelada automaticamente por vencimiento');
        return true;
      });
      if (cancelada) canceladas += 1;
    }
    if (canceladas > 0) this.logger.log(`${canceladas} reserva(s) vencida(s) cancelada(s)`);
    return canceladas;
  }

  private async vencerVencidasSeguro(): Promise<void> {
    try {
      await this.vencerVencidas();
    } catch (error) {
      this.logger.error(`No se pudieron vencer las reservas: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async liberarReserva(manager: EntityManager, reserva: Reserva, motivo: string): Promise<void> {
    const detalles = await manager.getRepository(DetalleReserva).find({ where: { idReserva: reserva.id }, order: { idVarianteProducto: 'ASC' } });
    for (const detalle of detalles) {
      await this.moverStockReservado(manager, reserva.idSucursal, detalle.idVarianteProducto, detalle.cantidad, true);
    }
    reserva.estado = 'CANCELADA';
    reserva.observaciones = [reserva.observaciones, `[${motivo}]`].filter(Boolean).join(' ');
    await manager.getRepository(Reserva).save(reserva);
  }

  private async construirLineas(
    manager: EntityManager,
    idSucursal: number,
    items: Array<{ idVarianteProducto: number; cantidad: number }>,
  ): Promise<LineaReserva[]> {
    const variantes = await manager.getRepository(VarianteProducto).find({
      where: { id: In(items.map((item) => item.idVarianteProducto)) },
      relations: { producto: true },
    });
    const activados = await manager.getRepository(ProductoSucursal).find({
      where: { idSucursal, idProducto: In([...new Set(variantes.map((variante) => variante.idProducto))]), activo: true },
    });

    return items.map((item) => {
      const variante = variantes.find((candidata) => candidata.id === item.idVarianteProducto);
      if (!variante) throw new NotFoundException(`Variante ${item.idVarianteProducto} no encontrada`);
      if (!variante.activo || !variante.producto?.activo) {
        throw new ConflictException(`La variante ${variante.sku} ya no esta disponible`);
      }
      if (!activados.some((activado) => activado.idProducto === variante.idProducto)) {
        throw new ConflictException(`"${variante.producto.nombre}" no se vende en esta sucursal`);
      }
      const precioUnitario = precioConDescuento(Number(variante.producto.precio), Number(variante.producto.descuentoPorcentaje));
      return { variante, cantidad: item.cantidad, precioUnitario, subtotal: redondear(precioUnitario * item.cantidad) };
    });
  }

  /** stock_disponible -> stock_reservado, repartido entre los almacenes activos de la sucursal. */
  private async apartarStock(manager: EntityManager, idSucursal: number, linea: LineaReserva): Promise<void> {
    const almacenes = await manager.getRepository(Almacen).find({ where: { idSucursal, activo: true }, select: { id: true } });
    const inventarios = await this.inventariosBloqueados(manager, almacenes, linea.variante.id);

    let restante = linea.cantidad;
    for (const inventario of inventarios) {
      if (restante === 0) break;
      const tomar = Math.min(inventario.stockDisponible, restante);
      if (tomar <= 0) continue;
      inventario.stockDisponible -= tomar;
      inventario.stockReservado += tomar;
      restante -= tomar;
      await manager.getRepository(Inventario).save(inventario);
    }

    if (restante > 0) {
      throw new BadRequestException(
        `Stock insuficiente en esta sucursal para ${linea.variante.producto.nombre} (${linea.variante.talla}/${linea.variante.color})`,
      );
    }
  }

  /** Reduce stock_reservado; con `devolver` el stock vuelve a stock_disponible (cancelacion). */
  private async moverStockReservado(
    manager: EntityManager,
    idSucursal: number,
    idVarianteProducto: number,
    cantidad: number,
    devolver: boolean,
  ): Promise<void> {
    const almacenes = await manager.getRepository(Almacen).find({ where: { idSucursal }, select: { id: true } });
    const inventarios = await this.inventariosBloqueados(manager, almacenes, idVarianteProducto);

    let restante = cantidad;
    for (const inventario of inventarios) {
      if (restante === 0) break;
      const tomar = Math.min(inventario.stockReservado, restante);
      if (tomar <= 0) continue;
      inventario.stockReservado -= tomar;
      if (devolver) inventario.stockDisponible += tomar;
      restante -= tomar;
      await manager.getRepository(Inventario).save(inventario);
    }

    // Nunca debe pasar (el stock reservado solo lo mueven las reservas), pero no debe bloquear cancelar ni liquidar.
    if (restante > 0) {
      this.logger.warn(`Inventario inconsistente: faltaron ${restante} unidad(es) reservadas de la variante ${idVarianteProducto}`);
    }
  }

  /** Filas de INVENTARIO de la variante en esos almacenes, bloqueadas y en orden fijo para evitar interbloqueos. */
  private async inventariosBloqueados(manager: EntityManager, almacenes: Array<{ id: number }>, idVarianteProducto: number): Promise<Inventario[]> {
    if (almacenes.length === 0) return [];
    return manager.getRepository(Inventario).find({
      where: { idAlmacen: In(almacenes.map((almacen) => almacen.id)), idVarianteProducto },
      order: { idAlmacen: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
  }

  private async bloquear(manager: EntityManager, id: number): Promise<Reserva> {
    const reserva = await manager.getRepository(Reserva).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!reserva) throw new NotFoundException('Reserva no encontrada');
    return reserva;
  }

  private validarVigente(reserva: Reserva): void {
    if (reserva.fechaLimite < new Date()) throw new ConflictException('La reserva ya vencio');
  }

  private async obtenerCajaAbierta(manager: EntityManager, idSucursal: number): Promise<Caja> {
    const caja = await manager.getRepository(Caja).findOne({ where: { idSucursal, estado: 'Abierta' } });
    if (!caja) throw new ConflictException('La sucursal no tiene una caja abierta');
    return caja;
  }

  private async validarPasarelaPresencial(manager: EntityManager, idPasarela: number): Promise<void> {
    const pasarela = await manager.getRepository(PasarelaPago).findOne({ where: { id: idPasarela } });
    if (!pasarela) throw new NotFoundException('Metodo de pago no encontrado');
    if (!pasarela.disponiblePresencial) throw new BadRequestException('El metodo de pago no esta habilitado para caja');
  }

  private registrarIngreso(manager: EntityManager, caja: Caja, concepto: string, monto: number, fechaHora: Date): Promise<MovimientoCaja> {
    const repo = manager.getRepository(MovimientoCaja);
    return repo.save(
      repo.create({ idCaja: caja.id, tipo: 'INGRESO', concepto: concepto.slice(0, 150), monto: monto.toFixed(2), observaciones: null, fechaHora }),
    );
  }

  private idCliente(usuario: ActiveUser): number {
    if (usuario.tipoUsuario !== 'C') throw new ForbiddenException('Solo los clientes tienen reservas propias');
    return usuario.sub;
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
      throw new ForbiddenException('No estas asignado a la sucursal de esta reserva');
    }
  }
}

/** Une lineas repetidas de la misma variante y las ordena para bloquear filas siempre en el mismo orden. */
function consolidarItems(items: CrearReservaDto['items']): Array<{ idVarianteProducto: number; cantidad: number }> {
  const porVariante = new Map<number, number>();
  for (const item of items) {
    porVariante.set(item.idVarianteProducto, (porVariante.get(item.idVarianteProducto) ?? 0) + item.cantidad);
  }
  return [...porVariante.entries()]
    .map(([idVarianteProducto, cantidad]) => ({ idVarianteProducto, cantidad }))
    .sort((a, b) => a.idVarianteProducto - b.idVarianteProducto);
}

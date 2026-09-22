import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { DataSource, type EntityManager, type Repository } from 'typeorm';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import type { AppConfig } from '../../../config/configuration.js';
import { DisponibilidadService } from '../../inventario/services/disponibilidad.service.js';
import { precioConDescuento } from '../../inventario/utils/precio.util.js';
import { DetalleNotaVenta } from '../../comercial/entities/detalle-nota-venta.entity.js';
import { NotaVenta } from '../../comercial/entities/nota-venta.entity.js';
import { Pago } from '../../comercial/entities/pago.entity.js';
import { PasarelaPago } from '../../comercial/entities/pasarela-pago.entity.js';
import { Carrito } from '../entities/carrito.entity.js';
import { Reserva } from '../entities/reserva.entity.js';
import { DetalleCarrito } from '../entities/detalle-carrito.entity.js';
import { NotificacionPush } from '../entities/notificacion-push.entity.js';
import { PaypalService } from './paypal.service.js';
import type {
  CodigoMetodoOnline,
  CompraOnlineResponseDto,
  IniciarPaypalResponseDto,
  IniciarQrResponseDto,
  MetodoPagoOnlineDto,
  PagoTarjetaDto,
} from '../dto/checkout.dto.js';

const METODOS_SOPORTADOS: CodigoMetodoOnline[] = ['QR', 'PAYPAL', 'TARJETA'];
const VIGENCIA_QR_MS = 15 * 60 * 1000;
/** Tarjeta de prueba: el pago simulado siempre la rechaza, para poder probar el flujo de error. */
const TARJETA_RECHAZADA = '4000000000000002';

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

function esViolacionUnica(error: unknown): boolean {
  return (error as { driverError?: { code?: string } }).driverError?.code === '23505';
}

/** Algoritmo de Luhn: detecta digitos mal tecleados en el numero de tarjeta. */
export function luhnValido(numero: string): boolean {
  let suma = 0;
  let duplicar = false;
  for (let i = numero.length - 1; i >= 0; i -= 1) {
    let digito = Number(numero[i]);
    if (duplicar) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }
    suma += digito;
    duplicar = !duplicar;
  }
  return suma % 10 === 0;
}

interface LineaCompra {
  idVarianteProducto: number;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

interface ResumenCarrito {
  idCarrito: number;
  /** Sucursal elegida en el catálogo (CU08): de ahí sale todo el stock de esta compra, sin repartir entre varias. */
  idSucursal: number;
  lineas: LineaCompra[];
  total: number;
}

interface OpcionesFinalizar {
  /** Comprueba que lo que el cliente autorizo (monto en Bs) sigue coincidiendo con lo que se va a cobrar ahora. */
  validar?: (montoBob: number) => void;
  /** Cobro real en la pasarela; se ejecuta al final de la transaccion, cuando todo lo demas ya salio bien. */
  cobrar?: () => Promise<unknown>;
}

interface PayloadQr {
  c: number;
  t: number;
  n: string;
  e: number;
  /** Reserva cuyo anticipo paga este QR; 0 cuando paga el carrito. Impide usar un QR para otra cosa. */
  r: number;
}

/**
 * Pago del carrito (CU14). El stock se descuenta y la venta se registra en una sola transaccion, y el cobro
 * en la pasarela va al final de ella: si no hay stock o falla algo antes, nunca se cobra; si el cobro falla,
 * todo se deshace. PayPal es real (sandbox/live); QR y tarjeta no tienen pasarela y se aprueban en simulacion.
 */
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(PasarelaPago) private readonly pasarelaRepo: Repository<PasarelaPago>,
    private readonly paypal: PaypalService,
    private readonly disponibilidad: DisponibilidadService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Metodos habilitados para pagar en linea (CU17) que este servidor sabe procesar. */
  async metodos(usuario: ActiveUser): Promise<MetodoPagoOnlineDto[]> {
    this.idCliente(usuario);
    const pasarelas = await this.pasarelaRepo.find({ where: { disponibleLinea: true }, order: { id: 'ASC' } });
    return pasarelas
      .filter((pasarela) => this.esOfrecible(pasarela))
      .map((pasarela) => ({
        id: pasarela.id,
        codigo: pasarela.codigo as CodigoMetodoOnline,
        metodo: pasarela.metodo,
        descripcion: pasarela.descripcion,
        simulado: pasarela.codigo !== 'PAYPAL',
      }));
  }

  async iniciarPaypal(usuario: ActiveUser, idReserva?: number): Promise<IniciarPaypalResponseDto> {
    const idCliente = this.idCliente(usuario);
    await this.pasarelaOnline('PAYPAL');
    const { monto, descripcion } = await this.montoAPagar(idCliente, idReserva);

    const frontend = this.config.get('frontendUrl', { infer: true });
    const sufijo = idReserva === undefined ? '' : `?reserva=${idReserva}`;
    const orden = await this.paypal.crearOrden({
      referencia: idReserva === undefined ? `C${idCliente}-${Date.now()}` : `${this.prefijoReserva(idCliente, idReserva)}${Date.now()}`,
      montoBob: monto,
      descripcion,
      // Al volver, la pagina de retorno sabe si cobra un carrito o el anticipo de una reserva.
      urlRetorno: `${frontend}/checkout/paypal/retorno${sufijo}`,
      urlCancelado: `${frontend}/checkout/paypal/cancelado${sufijo}`,
    });

    return { orderId: orden.id, urlAprobacion: orden.urlAprobacion, montoBob: monto, montoPaypal: orden.monto, monedaPaypal: this.paypal.moneda };
  }

  /** Vuelta desde PayPal: confirma que la orden es de este cliente y del monto correcto, y la cobra. */
  async capturarPaypal(usuario: ActiveUser, orderId: string, idReserva?: number): Promise<CompraOnlineResponseDto> {
    const idCliente = this.idCliente(usuario);
    const pasarela = await this.pasarelaOnline('PAYPAL');

    const referencia = `PAYPAL:${orderId}`;
    // Recargar la pagina de retorno no debe cobrar dos veces: se devuelve la compra ya registrada.
    const previa = await this.compraPorReferencia(referencia, idCliente);
    if (previa) return previa;

    const orden = await this.paypal.obtenerOrden(orderId);
    const prefijo = idReserva === undefined ? `C${idCliente}-` : this.prefijoReserva(idCliente, idReserva);
    if (!orden.referenceId.startsWith(prefijo)) throw new NotFoundException('Orden de PayPal no encontrada');
    if (orden.status !== 'APPROVED') {
      throw new ConflictException(orden.status === 'COMPLETED' ? 'Este pago ya fue procesado' : 'PayPal todavia no confirma que aprobaste el pago');
    }

    return this.finalizar(
      idCliente,
      pasarela,
      referencia,
      {
        validar: (montoBob) => {
          const esperado = this.paypal.aMonedaPaypal(montoBob);
          if (orden.moneda !== this.paypal.moneda || Math.abs(Number(orden.monto) - esperado) > 0.005) {
            throw new ConflictException('El monto a pagar cambio desde que iniciaste el pago. No se te cobro nada; vuelve a intentarlo');
          }
        },
        cobrar: () => this.paypal.capturar(orderId),
      },
      idReserva,
    );
  }

  /** Genera el QR de cobro (token firmado, sin estado en base de datos). */
  async iniciarQr(usuario: ActiveUser, idReserva?: number): Promise<IniciarQrResponseDto> {
    const idCliente = this.idCliente(usuario);
    await this.pasarelaOnline('QR');
    const { monto } = await this.montoAPagar(idCliente, idReserva);

    const expira = Date.now() + VIGENCIA_QR_MS;
    const referencia = this.firmar({ c: idCliente, t: monto, n: randomUUID(), e: expira, r: idReserva ?? 0 });
    return { referencia, montoBob: monto, expiraEn: new Date(expira).toISOString() };
  }

  /** Simula la confirmacion del banco: no hay pasarela QR real, asi que el cliente confirma que pago. */
  async confirmarQr(usuario: ActiveUser, referencia: string, idReserva?: number): Promise<CompraOnlineResponseDto> {
    const idCliente = this.idCliente(usuario);
    const pasarela = await this.pasarelaOnline('QR');

    const payload = this.verificar(referencia);
    if (!payload || payload.c !== idCliente || payload.r !== (idReserva ?? 0)) throw new BadRequestException('El codigo QR no es valido');
    if (payload.e < Date.now()) throw new ConflictException('El codigo QR vencio; genera uno nuevo');

    const clave = `QR:${payload.n}`;
    const previa = await this.compraPorReferencia(clave, idCliente);
    if (previa) return previa;

    return this.finalizar(
      idCliente,
      pasarela,
      clave,
      {
        validar: (montoBob) => {
          if (Math.abs(montoBob - payload.t) > 0.005) {
            throw new ConflictException('El monto a pagar cambio despues de generar el QR; genera uno nuevo');
          }
        },
      },
      idReserva,
    );
  }

  /** Pago simulado con tarjeta: valida el formato y aprueba. Los datos de la tarjeta no se guardan ni se registran. */
  async pagarTarjeta(usuario: ActiveUser, dto: PagoTarjetaDto, idReserva?: number): Promise<CompraOnlineResponseDto> {
    const idCliente = this.idCliente(usuario);
    const pasarela = await this.pasarelaOnline('TARJETA');

    const numero = dto.numero.replace(/\s/g, '');
    if (numero.length < 13 || numero.length > 19 || !luhnValido(numero)) throw new BadRequestException('El numero de tarjeta no es valido');
    const [mes, anio] = dto.vencimiento.split('/').map(Number);
    if (new Date(2000 + anio, mes, 1).getTime() <= Date.now()) throw new BadRequestException('La tarjeta esta vencida');
    if (dto.titular.trim().length < 3) throw new BadRequestException('Indica el nombre del titular');
    if (numero === TARJETA_RECHAZADA) throw new BadRequestException('Tu banco rechazo la tarjeta. Prueba con otra');

    return this.finalizar(idCliente, pasarela, `TARJETA:${randomUUID()}`, {}, idReserva);
  }

  /** Cobra el carrito (compra) o, con `idReserva`, el anticipo de una reserva. Todo o nada. */
  private async finalizar(
    idCliente: number,
    pasarela: PasarelaPago,
    referencia: string,
    opciones: OpcionesFinalizar,
    idReserva?: number,
  ): Promise<CompraOnlineResponseDto> {
    try {
      return await this.dataSource.transaction((manager) =>
        idReserva === undefined
          ? this.registrarCompra(manager, idCliente, pasarela, referencia, opciones)
          : this.registrarAnticipo(manager, idCliente, idReserva, pasarela, referencia, opciones),
      );
    } catch (error) {
      if (esViolacionUnica(error)) {
        const previa = await this.compraPorReferencia(referencia, idCliente);
        if (previa) return previa;
      }
      throw error;
    }
  }

  /** Cobra el anticipo de una reserva PENDIENTE: registra el pago (sin caja) y la deja PAGADA. */
  private async registrarAnticipo(
    manager: EntityManager,
    idCliente: number,
    idReserva: number,
    pasarela: PasarelaPago,
    referencia: string,
    opciones: OpcionesFinalizar,
  ): Promise<CompraOnlineResponseDto> {
    // Se bloquea la reserva: una cancelacion o el vencimiento simultaneos no pueden cruzarse con este cobro.
    const reserva = await manager.getRepository(Reserva).findOne({ where: { id: idReserva }, lock: { mode: 'pessimistic_write' } });
    this.validarReservaPagable(reserva, idCliente);
    const monto = Number(reserva.montoAnticipo);
    opciones.validar?.(monto);

    const ahora = new Date();
    const pagoRepo = manager.getRepository(Pago);
    await pagoRepo.save(
      pagoRepo.create({
        idMovimientoCaja: null,
        idPasarela: pasarela.id,
        idNotaVenta: null,
        idReserva: reserva.id,
        monto,
        concepto: 'ANTICIPO_RESERVA',
        referenciaExterna: referencia,
        fechaPago: formatearFecha(ahora),
        horaPago: formatearHora(ahora),
      }),
    );

    reserva.estado = 'PAGADA';
    await manager.getRepository(Reserva).save(reserva);

    const notificacionRepo = manager.getRepository(NotificacionPush);
    await notificacionRepo.save(
      notificacionRepo.create({
        idUsuario: idCliente,
        titulo: 'Reserva confirmada',
        mensaje: `Recibimos el anticipo de Bs ${monto.toFixed(2)} de tu reserva ${reserva.codigoReserva} con ${pasarela.metodo}. Retirala en la sucursal antes del ${reserva.fechaLimite.toLocaleString('es-BO')}.`,
      }),
    );

    // Igual que en la compra: el cobro real va al final, para que un fallo deje todo como estaba.
    if (opciones.cobrar) await opciones.cobrar();

    return {
      tipo: 'ANTICIPO_RESERVA',
      idNotaVenta: null,
      codigoNota: null,
      idReserva: reserva.id,
      codigoReserva: reserva.codigoReserva,
      montoTotal: monto,
      metodo: pasarela.metodo,
    };
  }

  /** Descuenta stock, registra la venta y el pago, vacia el carrito y, al final, cobra. */
  private async registrarCompra(
    manager: EntityManager,
    idCliente: number,
    pasarela: PasarelaPago,
    referencia: string,
    opciones: OpcionesFinalizar,
  ): Promise<CompraOnlineResponseDto> {
    const resumen = await this.resumenCarrito(manager, idCliente);
    opciones.validar?.(resumen.total);

    // El stock sale unicamente de la sucursal que el cliente tenia elegida en el catalogo al armar
    // el carrito: nunca de otra, aunque esa otra tenga mas unidades (por eso ya no se reparte ni se
    // "adivina" la sucursal mas conveniente — se evita despachar desde una ciudad que el cliente ni vio).
    for (const linea of resumen.lineas) {
      await this.descontarStock(manager, linea, resumen.idSucursal);
    }

    const ahora = new Date();
    const notaRepo = manager.getRepository(NotaVenta);
    const nota = await notaRepo.save(
      notaRepo.create({
        codigoNota: `TMP-${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        idCliente,
        idCajero: null,
        idSucursal: resumen.idSucursal,
        idPasarela: pasarela.id,
        idMovimientoCaja: null,
        idCarrito: resumen.idCarrito,
        idReserva: null,
        tipo: 'ONLINE',
        tipoVenta: 'E_COMMERCE',
        nroFactura: null,
        nitRazonSocial: null,
        fechaEmision: formatearFecha(ahora),
        horaEmision: formatearHora(ahora),
        subtotal: resumen.total,
        montoAnticipoAplicado: 0,
        descuento: 0,
        impuesto: 0,
        montoTotal: resumen.total,
        estadoPago: 'Pagado',
      }),
    );
    nota.codigoNota = `NV-${String(nota.id).padStart(6, '0')}`;
    await notaRepo.save(nota);

    const detalleRepo = manager.getRepository(DetalleNotaVenta);
    await detalleRepo.save(
      resumen.lineas.map((linea) =>
        detalleRepo.create({
          idNotaVenta: nota.id,
          idVarianteProducto: linea.idVarianteProducto,
          descripcion: linea.descripcion,
          precioUnitario: linea.precioUnitario,
          cantidad: linea.cantidad,
          subtotal: linea.subtotal,
        }),
      ),
    );

    // El indice unico de referencia_externa frena aqui un segundo intento del mismo cobro (doble clic, recarga).
    const pagoRepo = manager.getRepository(Pago);
    await pagoRepo.save(
      pagoRepo.create({
        idMovimientoCaja: null,
        idPasarela: pasarela.id,
        idNotaVenta: nota.id,
        idReserva: null,
        monto: resumen.total,
        concepto: 'PAGO_TOTAL',
        referenciaExterna: referencia,
        fechaPago: formatearFecha(ahora),
        horaPago: formatearHora(ahora),
      }),
    );

    await manager.getRepository(DetalleCarrito).delete({ idCarrito: resumen.idCarrito });
    await manager.getRepository(Carrito).update({ id: resumen.idCarrito }, { fechaActualizacion: ahora });

    const notificacionRepo = manager.getRepository(NotificacionPush);
    await notificacionRepo.save(
      notificacionRepo.create({
        idUsuario: idCliente,
        titulo: 'Compra confirmada',
        mensaje: `Recibimos tu pago de Bs ${resumen.total.toFixed(2)} con ${pasarela.metodo}. Tu compra es la ${nota.codigoNota}.`,
      }),
    );

    // Lo ultimo antes de confirmar: si PayPal no cobra, la transaccion se deshace y el stock vuelve.
    if (opciones.cobrar) await opciones.cobrar();

    return {
      tipo: 'COMPRA',
      idNotaVenta: nota.id,
      codigoNota: nota.codigoNota,
      idReserva: null,
      codigoReserva: null,
      montoTotal: resumen.total,
      metodo: pasarela.metodo,
    };
  }

  /** Lo que se cobrara ahora: el total del carrito (con aviso de stock) o el anticipo de la reserva. */
  private async montoAPagar(idCliente: number, idReserva?: number): Promise<{ monto: number; descripcion: string }> {
    if (idReserva !== undefined) {
      const reserva = await this.dataSource.getRepository(Reserva).findOne({ where: { id: idReserva } });
      this.validarReservaPagable(reserva, idCliente);
      return { monto: Number(reserva.montoAnticipo), descripcion: `Anticipo de la reserva ${reserva.codigoReserva} en FashionStore` };
    }

    const resumen = await this.resumenCarrito(this.dataSource.manager, idCliente);
    await this.validarStockDisponible(resumen);
    const unidades = resumen.lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
    return { monto: resumen.total, descripcion: `Compra en FashionStore (${unidades} ${unidades === 1 ? 'prenda' : 'prendas'})` };
  }

  /** Solo el dueno paga, una sola vez, y antes de que venza: es lo que mantiene el stock apartado. */
  private validarReservaPagable(reserva: Reserva | null, idCliente: number): asserts reserva is Reserva {
    // Una reserva ajena es indistinguible de una inexistente.
    if (!reserva || reserva.idCliente !== idCliente) throw new NotFoundException('Reserva no encontrada');
    if (reserva.estado === 'PAGADA') throw new ConflictException('El anticipo de esta reserva ya esta pagado');
    if (reserva.estado !== 'PENDIENTE') throw new ConflictException(`La reserva esta ${reserva.estado.toLowerCase()}; no admite pagos`);
    if (reserva.fechaLimite.getTime() < Date.now()) throw new ConflictException('La reserva ya vencio; haz una nueva');
    if (Number(reserva.montoAnticipo) <= 0) throw new ConflictException('Esta reserva no tiene anticipo por pagar');
  }

  private prefijoReserva(idCliente: number, idReserva: number): string {
    return `R${idCliente}-${idReserva}-`;
  }

  /**
   * Descuenta SOLO de los almacenes de `idSucursal` (puede tener más de uno,
   * pero nunca de otra sucursal): la que el cliente eligió en el catálogo. Si
   * ahí no alcanza, no se reparte con otra sucursal — se avisa y no se cobra.
   */
  private async descontarStock(manager: EntityManager, linea: LineaCompra, idSucursal: number): Promise<void> {
    const filas = await manager.query<Array<{ id: number; stock_disponible: number }>>(
      `SELECT i.id, i.stock_disponible
         FROM inventario i
         JOIN almacen a ON a.id = i.id_almacen
         JOIN sucursal s ON s.id = a.id_sucursal
         JOIN variante_producto v ON v.id = i.id_variante_producto
         JOIN producto_sucursal ps
           ON ps.id_producto = v.id_producto AND ps.id_sucursal = a.id_sucursal AND ps.activo = true
        WHERE i.id_variante_producto = $1
          AND a.id_sucursal = $2
          AND a.activo = true
          AND s.activo = true
          AND i.stock_disponible > 0
        ORDER BY i.stock_disponible DESC, i.id ASC
          FOR UPDATE OF i`,
      [linea.idVarianteProducto, idSucursal],
    );

    let restante = linea.cantidad;
    for (const fila of filas) {
      if (restante === 0) break;
      const tomar = Math.min(fila.stock_disponible, restante);
      await manager.query('UPDATE inventario SET stock_disponible = stock_disponible - $1 WHERE id = $2', [tomar, fila.id]);
      restante -= tomar;
    }

    if (restante > 0) {
      throw new ConflictException(
        `Ya no hay stock suficiente de ${linea.descripcion} en tu sucursal. No se te cobró nada; ajusta tu carrito o cambia de sucursal`,
      );
    }
  }

  private async resumenCarrito(manager: EntityManager, idCliente: number): Promise<ResumenCarrito> {
    const carrito = await manager.getRepository(Carrito).findOne({
      where: { idCliente },
      relations: { detalles: { variante: { producto: true } } },
    });
    if (!carrito || carrito.detalles.length === 0) throw new BadRequestException('Tu carrito esta vacio');
    if (!carrito.idSucursal) {
      throw new BadRequestException('Tu carrito no tiene una sucursal asignada; vuelve al catálogo, elige tu sucursal y agrega los productos de nuevo');
    }

    const lineas = [...carrito.detalles]
      .sort((a, b) => a.idVarianteProducto - b.idVarianteProducto)
      .map((detalle): LineaCompra => {
        const producto = detalle.variante?.producto;
        if (!detalle.variante?.activo || !producto?.activo) {
          throw new ConflictException(`"${producto?.nombre ?? 'Un producto'}" ya no esta disponible; quitalo del carrito para continuar`);
        }
        // Se cobra el precio vigente, no el guardado en el carrito.
        const precioUnitario = precioConDescuento(Number(producto.precio), Number(producto.descuentoPorcentaje));
        return {
          idVarianteProducto: detalle.idVarianteProducto,
          descripcion: `${producto.nombre} (${detalle.variante.talla}/${detalle.variante.color})`.slice(0, 255),
          cantidad: detalle.cantidad,
          precioUnitario,
          subtotal: redondear(precioUnitario * detalle.cantidad),
        };
      });

    return {
      idCarrito: carrito.id,
      idSucursal: carrito.idSucursal,
      lineas,
      total: redondear(lineas.reduce((suma, linea) => suma + linea.subtotal, 0)),
    };
  }

  /** Aviso amable antes de mandar al cliente a pagar; el descuento real y definitivo ocurre al finalizar. */
  private async validarStockDisponible(resumen: ResumenCarrito): Promise<void> {
    const stock = await this.disponibilidad.stockPorVariante(
      resumen.lineas.map((linea) => linea.idVarianteProducto),
      resumen.idSucursal,
    );
    for (const linea of resumen.lineas) {
      const disponible = stock.get(linea.idVarianteProducto) ?? 0;
      if (disponible < linea.cantidad) {
        throw new ConflictException(
          disponible === 0 ? `"${linea.descripcion}" esta agotado; quitalo del carrito` : `Solo quedan ${disponible} de "${linea.descripcion}"; ajusta la cantidad`,
        );
      }
    }
  }

  private esOfrecible(pasarela: PasarelaPago): boolean {
    if (!METODOS_SOPORTADOS.includes(pasarela.codigo as CodigoMetodoOnline)) return false;
    if (pasarela.codigo === 'PAYPAL') return this.paypal.configurado;
    return this.config.get('payments.simulated', { infer: true });
  }

  private async pasarelaOnline(codigo: CodigoMetodoOnline): Promise<PasarelaPago> {
    const pasarela = await this.pasarelaRepo.findOne({ where: { codigo, disponibleLinea: true } });
    if (!pasarela || !this.esOfrecible(pasarela)) throw new ConflictException('Este metodo de pago no esta disponible por ahora');
    return pasarela;
  }

  private async compraPorReferencia(referencia: string, idCliente: number): Promise<CompraOnlineResponseDto | null> {
    const pago = await this.dataSource.getRepository(Pago).findOne({
      where: { referenciaExterna: referencia },
      relations: { notaVenta: true, reserva: true, pasarela: true },
    });
    if (!pago) return null;

    if (pago.notaVenta) {
      if (pago.notaVenta.idCliente !== idCliente) return null;
      return {
        tipo: 'COMPRA',
        idNotaVenta: pago.notaVenta.id,
        codigoNota: pago.notaVenta.codigoNota,
        idReserva: null,
        codigoReserva: null,
        montoTotal: Number(pago.notaVenta.montoTotal),
        metodo: pago.pasarela?.metodo ?? '',
      };
    }
    if (pago.reserva && pago.reserva.idCliente === idCliente) {
      return {
        tipo: 'ANTICIPO_RESERVA',
        idNotaVenta: null,
        codigoNota: null,
        idReserva: pago.reserva.id,
        codigoReserva: pago.reserva.codigoReserva,
        montoTotal: Number(pago.monto),
        metodo: pago.pasarela?.metodo ?? '',
      };
    }
    return null;
  }

  private firmar(payload: PayloadQr): string {
    const cuerpo = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${cuerpo}.${this.firma(cuerpo)}`;
  }

  private verificar(token: string): PayloadQr | null {
    const [cuerpo, firma] = token.split('.');
    if (!cuerpo || !firma) return null;
    const esperada = Buffer.from(this.firma(cuerpo));
    const recibida = Buffer.from(firma);
    if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
    try {
      return JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as PayloadQr;
    } catch {
      return null;
    }
  }

  private firma(cuerpo: string): string {
    return createHmac('sha256', `${this.config.get('jwt.secret', { infer: true })}:pago-qr`).update(cuerpo).digest('base64url');
  }

  private idCliente(usuario: ActiveUser): number {
    if (usuario.tipoUsuario !== 'C') throw new ForbiddenException('El pago del carrito es solo para clientes');
    return usuario.sub;
  }
}

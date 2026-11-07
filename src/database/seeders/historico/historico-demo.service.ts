import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';
import { ahora, fijarReloj } from '../../../common/utils/reloj.js';
import type { ActiveUser } from '../../../modules/acceso/types/jwt-payload.type.js';
import { CajaService } from '../../../modules/comercial/services/caja.service.js';
import { ComprasService } from '../../../modules/comercial/services/compras.service.js';
import { DevolucionesService } from '../../../modules/comercial/services/devoluciones.service.js';
import { VentasService } from '../../../modules/comercial/services/ventas.service.js';
import type { SubcategoriaGasto } from '../../../modules/comercial/entities/movimiento-caja.entity.js';
import { CarritoService } from '../../../modules/electronico/services/carrito.service.js';
import { CheckoutService } from '../../../modules/electronico/services/checkout.service.js';
import { ReservasService } from '../../../modules/electronico/services/reservas.service.js';
import { AlmacenesService } from '../../../modules/inventario/services/almacenes.service.js';
import { InventarioService } from '../../../modules/inventario/services/inventario.service.js';
import { ProductosService } from '../../../modules/inventario/services/productos.service.js';
import { ProveedoresService } from '../../../modules/inventario/services/proveedores.service.js';
import { TransferenciasService } from '../../../modules/inventario/services/transferencias.service.js';
import { ClientesService } from '../../../modules/operaciones/services/clientes.service.js';
import { EmpleadosService } from '../../../modules/operaciones/services/empleados.service.js';
import { SucursalesService } from '../../../modules/operaciones/services/sucursales.service.js';
import { AprovisionamientoService } from '../../../modules/plataforma/services/aprovisionamiento.service.js';
import { Aleatorio } from './aleatorio.js';
import {
  APELLIDOS_DEMO,
  FACTOR_DIA,
  FACTOR_MES,
  NOMBRES_DEMO,
  PRENDAS_DEMO,
  PROVEEDORES_DEMO,
  SUCURSALES_DEMO,
  factorTemporada,
  type PrendaDemo,
} from './catalogo-demo.js';

export interface OpcionesHistorico {
  slug: string;
  meses: number;
  /** Ventas de mostrador por dia en la sucursal principal, antes de estacionalidad y tendencia. */
  ventasPorDia: number;
  semilla: number;
}

export interface ResumenHistorico {
  idEmpresa: number;
  slug: string;
  desde: string;
  hasta: string;
  adminEmail: string;
  adminPassword: string;
  conteo: Record<string, number>;
  fallas: Record<string, number>;
  ejemplosFalla: string[];
}

interface Variante {
  id: number;
  prenda: PrendaDemo;
  idProducto: number;
}

interface SucursalDemo {
  id: number;
  factor: number;
  idAlmacen: number;
  cajeros: ActiveUser[];
  /** Caja abierta del dia (si la hay). */
  idCaja: number | null;
}

interface Evento {
  momento: Date;
  tipo: string;
  ejecutar: () => Promise<void>;
}

const PASSWORD_DEMO = 'Demo123!';
const PUNTO_DE_REPOSICION = 6;
const MS_DIA = 24 * 60 * 60 * 1000;

/**
 * R10. Genera meses de operacion de una tienda de demostracion usando los services reales con el reloj simulado: asi
 * el kardex, el costo promedio, la caja, los pagos y las devoluciones quedan coherentes por construccion, igual que
 * si los hubiera hecho la gente desde la app. Solo para desarrollo; crea su propia empresa y no toca las demas.
 */
@Injectable()
export class HistoricoDemoService {
  private readonly logger = new Logger(HistoricoDemoService.name);
  private azar = new Aleatorio(1);
  private conteo: Record<string, number> = {};
  private fallas: Record<string, number> = {};
  private ejemplosFalla: string[] = [];
  /** Eventos programados para dias futuros (liquidar reservas, devoluciones), por fecha AAAA-MM-DD. */
  private agenda = new Map<string, Evento[]>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenant: TenantContext,
    private readonly aprovisionamiento: AprovisionamientoService,
    private readonly sucursales: SucursalesService,
    private readonly almacenes: AlmacenesService,
    private readonly proveedores: ProveedoresService,
    private readonly productos: ProductosService,
    private readonly empleados: EmpleadosService,
    private readonly clientes: ClientesService,
    private readonly cajas: CajaService,
    private readonly compras: ComprasService,
    private readonly ventas: VentasService,
    private readonly reservas: ReservasService,
    private readonly devoluciones: DevolucionesService,
    private readonly carrito: CarritoService,
    private readonly checkout: CheckoutService,
    private readonly inventario: InventarioService,
    private readonly transferencias: TransferenciasService,
  ) {}

  async generar(opciones: OpcionesHistorico): Promise<ResumenHistorico> {
    if (process.env.NODE_ENV === 'production') throw new Error('El generador de historia no corre en produccion');
    const existe = await this.dataSource.query<Array<{ id: number }>>('SELECT id FROM empresa WHERE slug = $1', [opciones.slug]);
    if (existe.length > 0) throw new Error(`La empresa "${opciones.slug}" ya existe; usa otro --slug (la historia no se mezcla con datos previos)`);

    this.azar = new Aleatorio(opciones.semilla);
    const hoy = new Date();
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - opciones.meses, 1);
    const adminEmail = `admin@${opciones.slug}.test`;

    try {
      // Dia 0: la empresa, su catalogo y su gente, a primera hora.
      fijarReloj(new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate(), 8, 0));
      const empresa = await this.aprovisionamiento.crearEmpresa({
        slug: opciones.slug,
        nombre: 'Tienda Demo BI',
        razonSocial: 'Tienda Demo BI SRL',
        admin: { nombre: 'Admin', apellido: 'Demo', email: adminEmail, password: PASSWORD_DEMO },
      });
      await this.tenant.ejecutarParaEmpresa(empresa.id, () => this.simular(empresa.id, adminEmail, inicio, fin, opciones));
      return {
        idEmpresa: empresa.id,
        slug: opciones.slug,
        desde: inicio.toISOString().slice(0, 10),
        hasta: fin.toISOString().slice(0, 10),
        adminEmail,
        adminPassword: PASSWORD_DEMO,
        conteo: this.conteo,
        fallas: this.fallas,
        ejemplosFalla: this.ejemplosFalla,
      };
    } finally {
      fijarReloj(null);
    }
  }

  private async simular(idEmpresa: number, adminEmail: string, inicio: Date, fin: Date, opciones: OpcionesHistorico): Promise<void> {
    const [{ id: idAdmin }] = await this.dataSource.query<Array<{ id: number }>>('SELECT id FROM usuario WHERE email = $1 AND id_empresa = $2', [adminEmail, idEmpresa]);
    const admin: ActiveUser = { sub: idAdmin, tipoUsuario: 'A', permisos: [], jti: 'historico', empresaId: idEmpresa };
    const pasarelas = await this.idsPasarelas(idEmpresa);

    const sucursales = await this.crearSucursales(idEmpresa, inicio);
    const idsProveedor = [];
    for (const proveedor of PROVEEDORES_DEMO) idsProveedor.push((await this.proveedores.crear({ ...proveedor })).id);
    const variantes = await this.crearCatalogo(idEmpresa, sucursales);
    const clientes: ActiveUser[] = [];
    await this.sumarClientes(clientes, idEmpresa, 40);

    // Stock inicial: todo el catalogo en las dos sucursales.
    for (const sucursal of sucursales) await this.reponer(sucursal, variantes, idsProveedor, admin, 0, true);

    const totalDias = Math.round((fin.getTime() - inicio.getTime()) / MS_DIA) + 1;
    for (let d = 0; d < totalDias; d++) {
      const dia = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + d);
      const mesIndice = (dia.getFullYear() - inicio.getFullYear()) * 12 + dia.getMonth() - inicio.getMonth();
      const eventos = this.eventosDelDia(dia, mesIndice, sucursales, variantes, clientes, idsProveedor, admin, pasarelas, opciones);
      eventos.push(...(this.agenda.get(clave(dia)) ?? []));
      this.agenda.delete(clave(dia));
      const porHora = (a: Evento, b: Evento) => a.momento.getTime() - b.momento.getTime();
      eventos.sort(porHora);

      while (eventos.length > 0) {
        const evento = eventos.shift() as Evento;
        fijarReloj(evento.momento);
        try {
          await evento.ejecutar();
          this.conteo[evento.tipo] = (this.conteo[evento.tipo] ?? 0) + 1;
        } catch (error) {
          this.fallas[evento.tipo] = (this.fallas[evento.tipo] ?? 0) + 1;
          if (this.ejemplosFalla.length < 15) this.ejemplosFalla.push(`${clave(dia)} ${evento.tipo}: ${(error as Error).message}`);
        }
        // Lo que un evento agenda para hoy mismo (p. ej. una reserva que se retira a la noche) entra en la cola del dia.
        const deHoy = this.agenda.get(clave(dia));
        if (deHoy) {
          this.agenda.delete(clave(dia));
          eventos.push(...deHoy);
          eventos.sort(porHora);
        }
      }

      // Altas de clientes durante el mes (clientes nuevos para el BI) y vencimiento de reservas al final del dia.
      if (this.azar.probabilidad(0.3)) {
        fijarReloj(conHora(dia, 22, 0));
        await this.sumarClientes(clientes, idEmpresa, this.azar.entero(1, 2));
      }
      fijarReloj(conHora(dia, 23, 50));
      await this.reservas.vencerVencidas(idEmpresa);

      if (dia.getDate() === 1 || d === totalDias - 1) {
        this.logger.log(`${clave(dia)}: ${JSON.stringify(this.conteo)}`);
      }
    }
  }

  // ---------------------------------------------------------------- preparacion

  private async idsPasarelas(idEmpresa: number): Promise<Record<string, number>> {
    const filas = await this.dataSource.query<Array<{ id: number; codigo: string }>>('SELECT id, codigo FROM pasarela_de_pago WHERE id_empresa = $1', [idEmpresa]);
    return Object.fromEntries(filas.map((fila) => [fila.codigo, fila.id]));
  }

  private async crearSucursales(idEmpresa: number, inicio: Date): Promise<SucursalDemo[]> {
    const ciudades = await this.dataSource.query<Array<{ id: number; nombre: string }>>('SELECT id, nombre FROM ciudad ORDER BY id');
    if (ciudades.length === 0) throw new Error('No hay ciudades cargadas; corre primero la app o el seed inicial');
    const resultado: SucursalDemo[] = [];
    for (const [i, datos] of SUCURSALES_DEMO.entries()) {
      const ciudad = ciudades.find((c) => c.nombre.toLowerCase() === datos.ciudadPreferida.toLowerCase()) ?? ciudades[i % ciudades.length];
      const sucursal = await this.sucursales.crear({ idCiudad: ciudad.id, nombre: datos.nombre, ubicacion: datos.ubicacion, horarioApertura: '09:00', horarioCierre: '21:00' });
      const almacen = await this.almacenes.crear({ idSucursal: sucursal.id, nombre: `Deposito ${datos.nombre}` });
      const cajeros: ActiveUser[] = [];
      for (let c = 0; c < 2; c++) {
        const empleado = await this.empleados.crear({
          nombre: this.azar.elegir(NOMBRES_DEMO),
          apellido: this.azar.elegir(APELLIDOS_DEMO),
          email: `cajero${i + 1}${c + 1}@demo.test`,
          password: PASSWORD_DEMO,
          salario: 3200,
          fechaContratacion: clave(inicio),
          sucursalIds: [sucursal.id],
        });
        cajeros.push({ sub: empleado.id, tipoUsuario: 'E', permisos: [], jti: 'historico', sucursalId: sucursal.id, empresaId: idEmpresa });
      }
      resultado.push({ id: sucursal.id, factor: datos.factor, idAlmacen: almacen.id, cajeros, idCaja: null });
    }
    return resultado;
  }

  private async crearCatalogo(idEmpresa: number, sucursales: SucursalDemo[]): Promise<Variante[]> {
    const categorias = await this.dataSource.query<Array<{ id: number; slug: string }>>('SELECT id, slug FROM categoria WHERE id_empresa = $1', [idEmpresa]);
    const variantes: Variante[] = [];
    for (const prenda of PRENDAS_DEMO) {
      const categoria = categorias.find((c) => c.slug === prenda.categoria) ?? categorias[0];
      const producto = await this.productos.crear({
        idCategoria: categoria.id,
        sucursalIds: sucursales.map((s) => s.id),
        nombre: prenda.nombre,
        descripcion: `${prenda.nombre} - coleccion demo`,
        precio: prenda.precio,
        variantes: prenda.tallas.flatMap((talla) =>
          prenda.colores.map((color) => ({ sku: `${prenda.codigo}-${talla}-${color.split(' ').map((p) => p.slice(0, 3)).join('').toUpperCase()}`, talla, color, corte: prenda.corte })),
        ),
      });
      for (const variante of producto.variantes) variantes.push({ id: variante.id, prenda, idProducto: producto.id });
    }
    return variantes;
  }

  private async sumarClientes(clientes: ActiveUser[], idEmpresa: number, cantidad: number): Promise<void> {
    for (let i = 0; i < cantidad; i++) {
      const n = clientes.length + 1;
      const nombre = this.azar.elegir(NOMBRES_DEMO);
      const cliente = await this.clientes.crear({
        nombre,
        apellido: this.azar.elegir(APELLIDOS_DEMO),
        email: `cliente${n}@demo.test`,
        password: PASSWORD_DEMO,
        ciudadResidencia: this.azar.elegir(['La Paz', 'Santa Cruz', 'Cochabamba', 'El Alto']),
      });
      clientes.push({ sub: cliente.id, tipoUsuario: 'C', permisos: [], jti: 'historico', empresaId: idEmpresa });
      this.conteo.CLIENTE_NUEVO = (this.conteo.CLIENTE_NUEVO ?? 0) + 1;
    }
  }

  // ---------------------------------------------------------------- un dia

  private eventosDelDia(
    dia: Date,
    mesIndice: number,
    sucursales: SucursalDemo[],
    variantes: Variante[],
    clientes: ActiveUser[],
    idsProveedor: number[],
    admin: ActiveUser,
    pasarelas: Record<string, number>,
    opciones: OpcionesHistorico,
  ): Evento[] {
    const eventos: Evento[] = [];
    const mes = dia.getMonth();
    const tendencia = 1 + 0.02 * mesIndice;
    const demanda = FACTOR_MES[mes] * FACTOR_DIA[dia.getDay()] * tendencia;
    const pesoVariante = (v: Variante) => v.prenda.popularidad * factorTemporada(v.prenda.temporada, mes);
    // Clientes frecuentes: los primeros (los mas antiguos) compran mas.
    const elegirCliente = () => this.azar.ponderado(clientes, (c) => 1 / Math.pow(clientes.indexOf(c) + 1, 0.6));

    // Liquidacion de fin de temporada: enero y julio con descuento en la ropa de la temporada que termina.
    if (dia.getDate() === 1 && (mes === 0 || mes === 6 || mes === 2 || mes === 8)) {
      const enLiquidacion = mes === 0 || mes === 6;
      const temporada = mes === 0 || mes === 2 ? 'VERANO' : 'INVIERNO';
      eventos.push(this.evento(conHora(dia, 7, 0), enLiquidacion ? 'LIQUIDACION_INICIO' : 'LIQUIDACION_FIN', () =>
        this.cambiarDescuentos(variantes, temporada, enLiquidacion ? 25 : 0)));
    }

    for (const sucursal of sucursales) {
      const cajero = sucursal.cajeros[dia.getDate() % 2];
      eventos.push(this.evento(conHora(dia, 9, 0), 'CAJA_APERTURA', async () => {
        sucursal.idCaja = (await this.cajas.abrir({ idSucursal: sucursal.id, montoInicial: 300 }, cajero)).id;
      }));
      eventos.push(this.evento(conHora(dia, 21, 0), 'CAJA_CIERRE', async () => {
        if (sucursal.idCaja) await this.cajas.cerrar(sucursal.idCaja, {}, cajero);
        sucursal.idCaja = null;
      }));

      // Reposicion semanal (lunes a primera hora, la registra el administrador).
      if (dia.getDay() === 1) {
        eventos.push(this.evento(conHora(dia, 8, 30), 'COMPRA', () => this.reponer(sucursal, variantes, idsProveedor, admin, mesIndice, false)));
      }

      // Ventas de mostrador.
      const cantidadVentas = this.azar.poisson(opciones.ventasPorDia * sucursal.factor * demanda);
      for (let v = 0; v < cantidadVentas; v++) {
        const items = this.elegirItems(variantes, pesoVariante);
        const conCliente = clientes.length > 0 && this.azar.probabilidad(0.35);
        const idCliente = conCliente ? elegirCliente().sub : undefined;
        const idPasarela = pasarelas[this.azar.ponderado(['EFECTIVO', 'QR', 'TARJETA'], (p) => (p === 'EFECTIVO' ? 6 : p === 'QR' ? 2.5 : 1.5))];
        const conDescuento = this.azar.probabilidad(0.06);
        eventos.push(this.evento(horaAlAzar(this.azar, dia, 9.5, 20.75), 'VENTA_MOSTRADOR', async () => {
          const subtotalAprox = items.reduce((s, i) => s + i.variante.prenda.precio * i.cantidad, 0);
          const venta = await this.ventas.crear(
            {
              idCliente,
              idPasarela,
              descuento: conDescuento ? Math.round(subtotalAprox * this.azar.rango(0.05, 0.1)) : undefined,
              items: items.map((i) => ({ idVarianteProducto: i.variante.id, cantidad: i.cantidad })),
            },
            cajero,
          );
          // Alrededor del 3% vuelve en los dias siguientes.
          if (this.azar.probabilidad(0.03)) this.programarDevolucion(dia, sucursal, venta.codigoNota, items[0], pasarelas.EFECTIVO);
        }));
      }

      // Reservas en tienda: anticipo hoy; despues se liquidan, se cancelan o vencen.
      const cantidadReservas = this.azar.poisson(0.35 * sucursal.factor * demanda);
      for (let r = 0; r < cantidadReservas && clientes.length > 0; r++) {
        const items = this.elegirItems(variantes, pesoVariante);
        const cliente = elegirCliente();
        eventos.push(this.evento(horaAlAzar(this.azar, dia, 10, 19), 'RESERVA', async () => {
          const reserva = await this.reservas.crear(
            { idCliente: cliente.sub, items: items.map((i) => ({ idVarianteProducto: i.variante.id, cantidad: i.cantidad })), horasLimite: 72 },
            cajero,
          );
          await this.reservas.registrarAnticipo(reserva.id, { idPasarela: pasarelas.EFECTIVO }, cajero);
          this.programarDesenlaceReserva(dia, sucursal, reserva.id, reserva.codigoReserva, pasarelas);
        }));
      }

      // Gastos del mes.
      for (const gasto of this.gastosDelDia(dia, sucursal)) {
        eventos.push(this.evento(conHora(dia, 18, 30), 'GASTO', async () => {
          if (!sucursal.idCaja) throw new Error('caja cerrada');
          await this.cajas.registrarMovimiento(
            sucursal.idCaja,
            { tipo: 'EGRESO', categoria: 'GASTO_OPERATIVO', subcategoriaGasto: gasto.subcategoria, concepto: gasto.concepto, monto: gasto.monto },
            cajero,
          );
        }));
      }

      // Una vez al mes: una prenda danada sale del inventario.
      if (dia.getDate() === 20) {
        eventos.push(this.evento(conHora(dia, 19, 0), 'AJUSTE', () => this.ajusteDanada(sucursal, variantes, cajero)));
      }
    }

    // Una transferencia al mes: la sucursal principal manda prendas de temporada a la otra.
    if (dia.getDate() === 15 && sucursales.length > 1) {
      eventos.push(this.evento(conHora(dia, 8, 45), 'TRANSFERENCIA', () => this.transferirTemporada(sucursales[0], sucursales[1], variantes, mes, admin)));
    }

    // Ventas en linea: crecen mas rapido que el mostrador.
    const cantidadOnline = this.azar.poisson(1.1 * FACTOR_MES[mes] * (1 + 0.05 * mesIndice) * (dia.getDay() === 0 ? 1.3 : 1));
    for (let o = 0; o < cantidadOnline && clientes.length > 0; o++) {
      const cliente = elegirCliente();
      const items = this.elegirItems(variantes, pesoVariante);
      const sucursal = this.azar.elegir(sucursales);
      const conTarjeta = this.azar.probabilidad(0.35);
      eventos.push(this.evento(horaAlAzar(this.azar, dia, 0, 23.9), 'VENTA_ONLINE', async () => {
        await this.carrito.vaciar(cliente);
        for (const item of items) {
          await this.carrito.agregarItem(cliente, { idVarianteProducto: item.variante.id, idSucursal: sucursal.id, cantidad: item.cantidad });
        }
        if (conTarjeta) {
          await this.checkout.pagarTarjeta(cliente, { titular: 'CLIENTE DEMO', numero: '4111111111111111', vencimiento: '12/39', cvv: '123' });
        } else {
          const qr = await this.checkout.iniciarQr(cliente);
          await this.checkout.confirmarQr(cliente, qr.referencia);
        }
      }));
    }

    return eventos;
  }

  private evento(momento: Date, tipo: string, ejecutar: () => Promise<void>): Evento {
    return { momento, tipo, ejecutar };
  }

  private elegirItems(variantes: Variante[], peso: (v: Variante) => number): Array<{ variante: Variante; cantidad: number }> {
    const cuantos = this.azar.ponderado([1, 2, 3], (n) => (n === 1 ? 55 : n === 2 ? 30 : 15));
    const elegidas = new Map<number, { variante: Variante; cantidad: number }>();
    for (let i = 0; i < cuantos; i++) {
      const variante = this.azar.ponderado(variantes, peso);
      const previa = elegidas.get(variante.id);
      if (previa) previa.cantidad++;
      else elegidas.set(variante.id, { variante, cantidad: this.azar.probabilidad(0.1) ? 2 : 1 });
    }
    return [...elegidas.values()];
  }

  private programarDevolucion(dia: Date, sucursal: SucursalDemo, codigoNota: string, item: { variante: Variante }, idEfectivo: number): void {
    const cuando = sumarDias(dia, this.azar.entero(1, 15));
    const merma = this.azar.probabilidad(0.3);
    const motivo = merma ? 'FALLA_FABRICA' : this.azar.elegir(['TALLA_INCORRECTA', 'ARREPENTIMIENTO'] as const);
    this.agendar(cuando, this.evento(horaAlAzar(this.azar, cuando, 10, 20), 'DEVOLUCION', async () => {
      await this.devoluciones.crear(
        {
          codigoNota,
          idPasarela: idEfectivo,
          motivoDevolucion: motivo,
          items: [{ idVarianteProducto: item.variante.id, cantidad: 1, idAlmacen: sucursal.idAlmacen, estadoProducto: merma ? 'MERMA_DEFECTUOSO' : 'REINGRESO_INVENTARIO' }],
        },
        this.cajeroDe(sucursal, cuando),
      );
    }));
  }

  private programarDesenlaceReserva(dia: Date, sucursal: SucursalDemo, idReserva: number, codigoReserva: string, pasarelas: Record<string, number>): void {
    const r = this.azar.siguiente();
    if (r < 0.7) {
      const cuando = sumarDias(dia, this.azar.entero(0, 2));
      // Mismo dia: un rato despues de reservar; otro dia: en horario de caja (siempre antes de las 72 h).
      const momento = clave(cuando) === clave(dia) ? conHora(dia, 20, 30) : horaAlAzar(this.azar, cuando, 10, 19);
      this.agendar(cuando, this.evento(momento, 'RESERVA_LIQUIDADA', async () => {
        await this.reservas.liquidar(idReserva, { idPasarela: pasarelas[this.azar.elegir(['EFECTIVO', 'QR'])] }, this.cajeroDe(sucursal, cuando));
      }));
    } else if (r < 0.85) {
      const cuando = sumarDias(dia, 1);
      const devuelveAnticipo = this.azar.probabilidad(0.5);
      this.agendar(cuando, this.evento(horaAlAzar(this.azar, cuando, 10, 19), 'RESERVA_CANCELADA', async () => {
        const cajero = this.cajeroDe(sucursal, cuando);
        await this.reservas.cancelar(idReserva, { motivo: 'El cliente desistio' }, cajero);
        if (devuelveAnticipo) {
          await this.devoluciones.crear({ codigoReserva, idPasarela: pasarelas.EFECTIVO, motivoDevolucion: 'CANCELACION' }, cajero);
        }
      }));
    }
    // El 15% restante vence solo: lo hace vencerVencidas al final del dia en que pasa el limite.
  }

  private agendar(dia: Date, evento: Evento): void {
    const lista = this.agenda.get(clave(dia)) ?? [];
    lista.push(evento);
    this.agenda.set(clave(dia), lista);
  }

  private cajeroDe(sucursal: SucursalDemo, dia: Date): ActiveUser {
    return sucursal.cajeros[dia.getDate() % 2];
  }

  private gastosDelDia(dia: Date, sucursal: SucursalDemo): Array<{ subcategoria: SubcategoriaGasto; concepto: string; monto: number }> {
    const mes = dia.getMonth();
    const ultimoDia = new Date(dia.getFullYear(), mes + 1, 0).getDate();
    const gastos: Array<{ subcategoria: SubcategoriaGasto; concepto: string; monto: number }> = [];
    const escala = sucursal.factor;
    if (dia.getDate() === 5) gastos.push({ subcategoria: 'ALQUILER', concepto: 'Alquiler del local', monto: Math.round(3500 * escala) });
    if (dia.getDate() === 12) gastos.push({ subcategoria: 'SERVICIOS', concepto: 'Luz, agua e internet', monto: Math.round(this.azar.rango(380, 620) * (mes >= 4 && mes <= 7 ? 1.25 : 1)) });
    if (dia.getDate() === 8) {
      const campana = mes === 10 || mes === 11 ? 2.5 : mes === 4 ? 1.6 : 1;
      gastos.push({ subcategoria: 'MARKETING', concepto: 'Publicidad en redes', monto: Math.round(this.azar.rango(250, 600) * campana * escala) });
    }
    if (dia.getDate() === 18 && this.azar.probabilidad(0.5)) gastos.push({ subcategoria: 'TRANSPORTE', concepto: 'Flete de mercaderia', monto: Math.round(this.azar.rango(120, 350)) });
    if (dia.getDate() === 22 && this.azar.probabilidad(0.25)) gastos.push({ subcategoria: 'MANTENIMIENTO', concepto: 'Arreglos del local', monto: Math.round(this.azar.rango(150, 900)) });
    if (dia.getDate() === ultimoDia) gastos.push({ subcategoria: 'SUELDOS', concepto: 'Sueldos de cajeros', monto: 2 * 3200 });
    return gastos;
  }

  // ---------------------------------------------------------------- inventario

  /** Compra a cada proveedor lo que falta para llegar al stock objetivo de la temporada. */
  private async reponer(sucursal: SucursalDemo, variantes: Variante[], idsProveedor: number[], admin: ActiveUser, mesIndice: number, inicial: boolean): Promise<void> {
    const stock = await this.stockPorVariante(sucursal.idAlmacen);
    const mes = ahora().getMonth();
    const porProveedor = new Map<number, Array<{ idVarianteProducto: number; idAlmacen: number; cantidad: number; precioUnitario: number }>>();
    for (const variante of variantes) {
      const actual = stock.get(variante.id) ?? 0;
      const temporada = factorTemporada(variante.prenda.temporada, mes);
      const objetivo = Math.max(4, Math.round(10 * variante.prenda.popularidad * temporada * sucursal.factor));
      if (!inicial && actual >= PUNTO_DE_REPOSICION && actual >= objetivo / 2) continue;
      const cantidad = objetivo + 4 - actual;
      if (cantidad <= 0) continue;
      // El costo sube ~0,5% por mes, con ruido de cada factura.
      const costo = variante.prenda.precio * variante.prenda.margenCosto * (1 + 0.005 * mesIndice) * this.azar.rango(0.97, 1.03);
      const lineas = porProveedor.get(variante.prenda.proveedor) ?? [];
      lineas.push({ idVarianteProducto: variante.id, idAlmacen: sucursal.idAlmacen, cantidad, precioUnitario: Math.round(costo * 100) / 100 });
      porProveedor.set(variante.prenda.proveedor, lineas);
    }
    for (const [indice, detalles] of porProveedor) {
      await this.compras.registrar({ idProveedor: idsProveedor[indice], idSucursal: sucursal.id, detalles }, admin);
    }
  }

  private async stockPorVariante(idAlmacen: number): Promise<Map<number, number>> {
    const filas = await this.dataSource.query<Array<{ id_variante_producto: number; stock_disponible: number }>>(
      'SELECT id_variante_producto, stock_disponible FROM inventario WHERE id_almacen = $1',
      [idAlmacen],
    );
    return new Map(filas.map((fila) => [fila.id_variante_producto, fila.stock_disponible]));
  }

  private async cambiarDescuentos(variantes: Variante[], temporada: 'VERANO' | 'INVIERNO', porcentaje: number): Promise<void> {
    const productos = new Set(variantes.filter((v) => v.prenda.temporada === temporada).map((v) => v.idProducto));
    for (const idProducto of productos) await this.productos.actualizar(idProducto, { descuentoPorcentaje: porcentaje });
  }

  private async ajusteDanada(sucursal: SucursalDemo, variantes: Variante[], cajero: ActiveUser): Promise<void> {
    const variante = this.azar.elegir(variantes);
    const [fila] = await this.dataSource.query<Array<{ id: number; stock_disponible: number }>>(
      'SELECT id, stock_disponible FROM inventario WHERE id_almacen = $1 AND id_variante_producto = $2',
      [sucursal.idAlmacen, variante.id],
    );
    if (!fila || fila.stock_disponible < 1) throw new Error('sin stock para el ajuste');
    await this.inventario.ajustar(fila.id, { tipo: 'SALIDA', cantidad: 1, motivo: 'Prenda danada en vitrina' }, cajero);
  }

  private async transferirTemporada(origen: SucursalDemo, destino: SucursalDemo, variantes: Variante[], mes: number, admin: ActiveUser): Promise<void> {
    const stock = await this.stockPorVariante(origen.idAlmacen);
    const candidatas = variantes.filter((v) => factorTemporada(v.prenda.temporada, mes) >= 1 && (stock.get(v.id) ?? 0) >= 6);
    if (candidatas.length === 0) throw new Error('sin stock para transferir');
    const variante = this.azar.elegir(candidatas);
    await this.transferencias.transferir(
      { idAlmacenOrigen: origen.idAlmacen, idAlmacenDestino: destino.idAlmacen, idVarianteProducto: variante.id, cantidad: 3, motivo: 'Reponer la otra sucursal' },
      admin,
    );
  }
}

// ---------------------------------------------------------------- fechas

function clave(dia: Date): string {
  return `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
}

function conHora(dia: Date, hora: number, minuto: number): Date {
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hora, minuto, 0);
}

function horaAlAzar(azar: Aleatorio, dia: Date, desde: number, hasta: number): Date {
  const minutos = Math.floor(azar.rango(desde * 60, hasta * 60));
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), Math.floor(minutos / 60), minutos % 60, azar.entero(0, 59));
}

function sumarDias(dia: Date, dias: number): Date {
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() + dias);
}

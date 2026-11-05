/**
 * Carga datos de prueba: catalogo (productos + variantes + stock), clientes, proveedores, compras,
 * ~3 meses de ventas presenciales y en linea, reservas en todos sus estados, devoluciones, cajas
 * diarias y carritos con productos. Solo AGREGA filas: no toca ni borra los datos existentes.
 *
 *   npm run seed:demo
 *
 * Se niega a correr dos veces (detecta los clientes @demo.fashionstore.com). Todo va en una sola
 * transaccion: si algo falla no queda nada a medias. Los datos son reproducibles (semilla fija) y
 * respetan las mismas reglas que los servicios: codigos NV/RS/DV-<id>, anticipo minimo del 20%,
 * stock reservado, movimientos de caja por cada cobro/reembolso y caja cerrada con su saldo final.
 */
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { DataSource, In, Like, type EntityManager } from 'typeorm';
import { AppModule } from '../../app.module.js';
import { Usuario } from '../../modules/acceso/entities/usuario.entity.js';
import { Caja } from '../../modules/comercial/entities/caja.entity.js';
import { DetalleNotaCompra } from '../../modules/comercial/entities/detalle-nota-compra.entity.js';
import { DetalleNotaDevolucion } from '../../modules/comercial/entities/detalle-nota-devolucion.entity.js';
import { DetalleNotaVenta } from '../../modules/comercial/entities/detalle-nota-venta.entity.js';
import { MovimientoCaja } from '../../modules/comercial/entities/movimiento-caja.entity.js';
import { NotaCompra } from '../../modules/comercial/entities/nota-compra.entity.js';
import { NotaDevolucion, type MotivoDevolucion } from '../../modules/comercial/entities/nota-devolucion.entity.js';
import { NotaVenta } from '../../modules/comercial/entities/nota-venta.entity.js';
import { Pago } from '../../modules/comercial/entities/pago.entity.js';
import { PasarelaPago } from '../../modules/comercial/entities/pasarela-pago.entity.js';
import { Carrito } from '../../modules/electronico/entities/carrito.entity.js';
import { DetalleCarrito } from '../../modules/electronico/entities/detalle-carrito.entity.js';
import { DetalleReserva } from '../../modules/electronico/entities/detalle-reserva.entity.js';
import { Reserva } from '../../modules/electronico/entities/reserva.entity.js';
import { Almacen } from '../../modules/inventario/entities/almacen.entity.js';
import { Categoria } from '../../modules/inventario/entities/categoria.entity.js';
import { Inventario } from '../../modules/inventario/entities/inventario.entity.js';
import { ProductoSucursal } from '../../modules/inventario/entities/producto-sucursal.entity.js';
import { Producto } from '../../modules/inventario/entities/producto.entity.js';
import { Proveedor } from '../../modules/inventario/entities/proveedor.entity.js';
import { VarianteProducto } from '../../modules/inventario/entities/variante-producto.entity.js';
import { Cliente } from '../../modules/operaciones/entities/cliente.entity.js';
import { EmpleadoSucursal } from '../../modules/operaciones/entities/empleado-sucursal.entity.js';
import { Sucursal } from '../../modules/operaciones/entities/sucursal.entity.js';

/** Contrasena de prueba de todos los clientes demo (solo para el entorno local). */
const DEMO_PASSWORD = 'Cliente123!';
const DOMINIO_DEMO = 'demo.fashionstore.com';
const EMAIL_CONSUMIDOR_FINAL = 'consumidor.final@fashionstore.local';
const DIAS_HISTORIAL = 90;

// ---------------------------------------------------------------- catalogo

interface ProductoDemo {
  nombre: string;
  categoria: string; // slug
  precio: number;
  descuento: number;
  descripcion: string;
  corte: string;
  tallas: string[];
  colores: string[];
}

const TALLAS_ROPA = ['S', 'M', 'L', 'XL'];
const TALLAS_JEAN = ['26', '28', '30', '32'];

const PRODUCTOS: ProductoDemo[] = [
  { nombre: 'Blusa de Lino Manga Corta', categoria: 'blusas', precio: 145, descuento: 0, descripcion: 'Blusa fresca de lino con botones de nacar, ideal para el calor.', corte: 'Regular', tallas: ['S', 'M', 'L'], colores: ['Blanco', 'Beige', 'Celeste'] },
  { nombre: 'Blusa Satinada Cuello V', categoria: 'blusas', precio: 165, descuento: 10, descripcion: 'Blusa de satin con caida suave y cuello en V.', corte: 'Holgado', tallas: ['S', 'M', 'L'], colores: ['Champagne', 'Negro'] },
  { nombre: 'Camisa Oxford Clasica', categoria: 'camisas', precio: 180, descuento: 0, descripcion: 'Camisa de algodon Oxford, cuello abotonado.', corte: 'Slim', tallas: TALLAS_ROPA, colores: ['Blanco', 'Celeste'] },
  { nombre: 'Camisa de Franela a Cuadros', categoria: 'camisas', precio: 170, descuento: 15, descripcion: 'Franela gruesa a cuadros para dias frescos.', corte: 'Regular', tallas: TALLAS_ROPA, colores: ['Rojo', 'Verde'] },
  { nombre: 'Abrigo Pano Largo', categoria: 'abrigos', precio: 520, descuento: 20, descripcion: 'Abrigo largo de pano con forro interior y bolsillos laterales.', corte: 'Recto', tallas: ['S', 'M', 'L'], colores: ['Negro', 'Camel'] },
  { nombre: 'Chaqueta Denim Oversize', categoria: 'chaquetas', precio: 290, descuento: 0, descripcion: 'Chaqueta de jean lavado con corte amplio.', corte: 'Oversize', tallas: TALLAS_ROPA, colores: ['Azul', 'Negro'] },
  { nombre: 'Chaqueta Cuerina Biker', categoria: 'chaquetas', precio: 380, descuento: 0, descripcion: 'Chaqueta estilo biker de cuerina con cierres metalicos.', corte: 'Slim', tallas: ['S', 'M', 'L'], colores: ['Negro'] },
  { nombre: 'Sueter Tejido Cuello Alto', categoria: 'sueteres', precio: 210, descuento: 0, descripcion: 'Sueter tejido grueso de cuello alto.', corte: 'Regular', tallas: ['S', 'M', 'L'], colores: ['Gris', 'Crema', 'Negro'] },
  { nombre: 'Polera Basica Algodon', categoria: 'poleras', precio: 69, descuento: 0, descripcion: 'Polera 100% algodon peinado, cuello redondo.', corte: 'Regular', tallas: TALLAS_ROPA, colores: ['Blanco', 'Negro', 'Gris'] },
  { nombre: 'Polera Estampada Urbana', categoria: 'poleras', precio: 89, descuento: 0, descripcion: 'Polera con estampado frontal en serigrafia.', corte: 'Oversize', tallas: TALLAS_ROPA, colores: ['Negro', 'Blanco'] },
  { nombre: 'Jean Mom Fit Tiro Alto', categoria: 'jeans', precio: 230, descuento: 0, descripcion: 'Jean de tiro alto con pierna recta y ruedo al tobillo.', corte: 'Mom Fit', tallas: TALLAS_JEAN, colores: ['Azul claro', 'Azul oscuro'] },
  { nombre: 'Jean Skinny Elastizado', categoria: 'jeans', precio: 210, descuento: 25, descripcion: 'Jean skinny con elastano para mayor comodidad.', corte: 'Skinny', tallas: TALLAS_JEAN, colores: ['Negro', 'Azul'] },
  { nombre: 'Falda Plisada Midi', categoria: 'faldas', precio: 160, descuento: 0, descripcion: 'Falda midi plisada con pretina elastica.', corte: 'Plisado', tallas: ['S', 'M', 'L'], colores: ['Negro', 'Verde oliva'] },
  { nombre: 'Short Denim Desflecado', categoria: 'shorts', precio: 120, descuento: 0, descripcion: 'Short de jean con ruedo desflecado.', corte: 'Recto', tallas: ['S', 'M', 'L'], colores: ['Azul claro'] },
  { nombre: 'Vestido Floral Midi', categoria: 'vestidos', precio: 260, descuento: 0, descripcion: 'Vestido midi con estampado floral y escote cruzado.', corte: 'Evase', tallas: ['S', 'M', 'L'], colores: ['Floral rosa', 'Floral azul'] },
  { nombre: 'Vestido Negro Coctel', categoria: 'vestidos', precio: 310, descuento: 0, descripcion: 'Vestido corto ajustado para eventos.', corte: 'Ajustado', tallas: ['S', 'M', 'L'], colores: ['Negro'] },
  { nombre: 'Enterizo de Lino', categoria: 'enterizos', precio: 280, descuento: 10, descripcion: 'Enterizo de lino con cinturon y pierna ancha.', corte: 'Holgado', tallas: ['S', 'M', 'L'], colores: ['Beige', 'Terracota'] },
  { nombre: 'Mono Deportivo Rib', categoria: 'monos', precio: 190, descuento: 0, descripcion: 'Mono deportivo de tela rib, ajustado al cuerpo.', corte: 'Ajustado', tallas: ['S', 'M', 'L'], colores: ['Negro', 'Gris'] },
];

const PROVEEDORES = [
  { empresa: 'Textiles Andinos S.R.L.', nit: '1029384017', nombreContacto: 'Marcelo Quispe', telefonoContacto: '71234501', correoContacto: 'ventas@textilesandinos.bo', categorias: ['blusas', 'camisas', 'sueteres'] },
  { empresa: 'Denim Factory Bolivia', nit: '2038475012', nombreContacto: 'Lucia Vargas', telefonoContacto: '72345602', correoContacto: 'pedidos@denimfactory.bo', categorias: ['jeans', 'shorts', 'chaquetas'] },
  { empresa: 'Moda Express Importaciones', nit: '3047566013', nombreContacto: 'Andres Mendoza', telefonoContacto: '73456703', correoContacto: 'contacto@modaexpress.bo', categorias: ['vestidos', 'enterizos', 'monos', 'faldas'] },
  { empresa: 'Confecciones El Alto', nit: '4056657014', nombreContacto: 'Rosa Mamani', telefonoContacto: '74567804', correoContacto: 'rosa@confeccioneselalto.bo', categorias: ['poleras', 'abrigos'] },
];

const CLIENTES = [
  ['Ana', 'Rojas', 'F', 'Santa Cruz de la Sierra', 'Av. Banzer 4to anillo #1520'],
  ['Carlos', 'Gutierrez', 'M', 'Santa Cruz de la Sierra', 'Calle Sucre #345'],
  ['Valeria', 'Flores', 'F', 'Santa Cruz de la Sierra', 'Barrio Equipetrol, calle 7 #12'],
  ['Diego', 'Vargas', 'M', 'Santa Cruz de la Sierra', 'Av. Alemana #2100'],
  ['Camila', 'Mendoza', 'F', 'Cochabamba', 'Av. America #980'],
  ['Jorge', 'Quiroga', 'M', 'Santa Cruz de la Sierra', 'Plan 3000, UV 160'],
  ['Mariana', 'Suarez', 'F', 'Santa Cruz de la Sierra', 'Av. Paragua #3300'],
  ['Luis', 'Choque', 'M', 'La Paz', 'Calle 21 de Calacoto #45'],
  ['Daniela', 'Arce', 'F', 'Santa Cruz de la Sierra', 'Urb. Las Palmas, casa 18'],
  ['Fernando', 'Salvatierra', 'M', 'Santa Cruz de la Sierra', 'Av. Pirai #770'],
  ['Gabriela', 'Montano', 'F', 'Trinidad', 'Calle Cipriano Barace #66'],
  ['Ricardo', 'Pinto', 'M', 'Santa Cruz de la Sierra', 'Av. Busch #1450'],
  ['Natalia', 'Rivero', 'F', 'Santa Cruz de la Sierra', 'Calle Ingavi #210'],
  ['Sebastian', 'Justiniano', 'M', 'Santa Cruz de la Sierra', 'Av. Santos Dumont #3900'],
  ['Paola', 'Antelo', 'F', 'Santa Cruz de la Sierra', 'Barrio Hamacas, calle 3 #9'],
] as const;

// ---------------------------------------------------------------- utilidades

/** PRNG con semilla (mulberry32): mismos datos en cada maquina. */
function crearAleatorio(semilla: number) {
  let estado = semilla;
  const siguiente = (): number => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    siguiente,
    entero: (min: number, max: number): number => min + Math.floor(siguiente() * (max - min + 1)),
    elegir: <T>(lista: readonly T[]): T => lista[Math.floor(siguiente() * lista.length)],
    chance: (probabilidad: number): boolean => siguiente() < probabilidad,
  };
}

const rnd = crearAleatorio(20261104);
const redondear = (valor: number): number => Math.round(valor * 100) / 100;
const pad = (n: number, largo = 2): string => String(n).padStart(largo, '0');
const formatearFecha = (fecha: Date): string => `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
const formatearHora = (fecha: Date): string => fecha.toTimeString().slice(0, 8);
const codigo = (prefijo: string, id: number): string => `${prefijo}-${pad(id, 6)}`;
const provisional = (): string => `TMP-${randomUUID().replace(/-/g, '').slice(0, 16)}`;
const sinTildes = (texto: string): string => texto.normalize('NFD').replace(/[̀-ͯ]/g, '');

const HOY = new Date();
HOY.setHours(0, 0, 0, 0);

/** Fecha local a `diasAtras` de hoy, a la hora indicada. */
function momento(diasAtras: number, hora: number, minuto = 0): Date {
  const fecha = new Date(HOY);
  fecha.setDate(fecha.getDate() - diasAtras);
  fecha.setHours(hora, minuto, rnd.entero(0, 59), 0);
  return fecha;
}

function horaComercial(diasAtras: number): Date {
  return momento(diasAtras, rnd.entero(9, 19), rnd.entero(0, 59));
}

// ---------------------------------------------------------------- tipos de trabajo

interface VarianteDemo {
  variante: VarianteProducto;
  producto: Producto;
  precioFinal: number;
  categoria: string;
}

interface SucursalDemo {
  sucursal: Sucursal;
  almacen: Almacen;
  cajeros: number[];
  peso: number;
}

interface Linea {
  item: VarianteDemo;
  cantidad: number;
}

interface CajaDia {
  caja: Caja;
  saldo: number;
}

interface VentaHecha {
  nota: NotaVenta;
  lineas: Linea[];
  dia: number;
  suc: SucursalDemo;
}

// ---------------------------------------------------------------- seeder

class DemoSeeder {
  private readonly cajas = new Map<string, CajaDia>();
  private readonly stock = new Map<string, Inventario>();
  private readonly carritos = new Map<number, Carrito>();
  private readonly pasarelas = new Map<string, PasarelaPago>();
  private readonly eventos = new Map<number, Array<() => Promise<void>>>();
  private readonly ventasDevolvibles: VentaHecha[] = [];
  private readonly reservasActivasPorCliente = new Map<number, number>();
  private catalogo: VarianteDemo[] = [];
  private sucursales: SucursalDemo[] = [];
  private clientes: number[] = [];
  private consumidorFinal: number | null = null;
  private proveedores: Array<{ proveedor: Proveedor; categorias: string[] }> = [];
  private readonly conteo = { productos: 0, variantes: 0, compras: 0, ventasPresenciales: 0, ventasEnLinea: 0, reservas: 0, liquidaciones: 0, devoluciones: 0, cajas: 0 };

  constructor(private readonly m: EntityManager) {}

  async run(): Promise<Record<string, number>> {
    await this.cargarReferencias();
    await this.crearClientes();
    await this.crearProveedores();
    await this.crearCatalogo();

    for (let dia = DIAS_HISTORIAL + 5; dia >= 1; dia -= 1) {
      await this.simularDia(dia);
    }
    await this.crearReservasActivas();
    await this.crearCarritosConProductos();
    await this.abrirCajasDeHoy();
    await this.guardarStock();
    await this.cerrarCajas();
    return this.conteo;
  }

  // ------------------------------------------------------------ referencias

  private async cargarReferencias(): Promise<void> {
    const sucursales = await this.m.getRepository(Sucursal).find({ where: { activo: true }, order: { id: 'ASC' } });
    for (const [indice, sucursal] of sucursales.entries()) {
      const almacen = await this.m.getRepository(Almacen).findOne({ where: { idSucursal: sucursal.id, activo: true }, order: { id: 'ASC' } });
      if (!almacen) continue;
      const asignaciones = await this.m.getRepository(EmpleadoSucursal).find({ where: { idSucursal: sucursal.id, activo: true } });
      this.sucursales.push({ sucursal, almacen, cajeros: asignaciones.map((a) => a.idEmpleado), peso: indice === 0 ? 3 : 1 });
    }
    if (this.sucursales.length === 0) throw new Error('No hay sucursales activas con almacen: crea al menos una antes de sembrar.');

    for (const pasarela of await this.m.getRepository(PasarelaPago).find()) this.pasarelas.set(pasarela.codigo, pasarela);
    for (const requerida of ['EFECTIVO', 'QR', 'TARJETA']) {
      if (!this.pasarelas.has(requerida)) throw new Error(`Falta la pasarela ${requerida}: arranca el backend una vez para sembrarla.`);
    }

    const consumidor = await this.m.getRepository(Usuario).findOne({ where: { email: EMAIL_CONSUMIDOR_FINAL } });
    if (consumidor && (await this.m.getRepository(Cliente).findOne({ where: { idUsuario: consumidor.id } }))) {
      this.consumidorFinal = consumidor.id;
    }
  }

  private elegirSucursal(): SucursalDemo {
    const total = this.sucursales.reduce((suma, s) => suma + s.peso, 0);
    let tiro = rnd.siguiente() * total;
    for (const suc of this.sucursales) {
      tiro -= suc.peso;
      if (tiro < 0) return suc;
    }
    return this.sucursales[0];
  }

  // ------------------------------------------------------------ maestros

  private async crearClientes(): Promise<void> {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    for (const [indice, [nombre, apellido, sexo, ciudad, direccion]] of CLIENTES.entries()) {
      const usuario = await this.m.getRepository(Usuario).save(
        this.m.getRepository(Usuario).create({
          nombre,
          apellido,
          email: `${sinTildes(nombre).toLowerCase()}.${sinTildes(apellido).toLowerCase()}@${DOMINIO_DEMO}`,
          telefono: `7${pad(1000000 + indice * 73519, 7)}`,
          passwordHash,
          sexo,
          tipoUsuario: 'C',
          estadoAcceso: 'HABILITADO',
          intentosFallidos: 0,
          activo: true,
          fechaCreacion: momento(DIAS_HISTORIAL + 10 - indice, 10),
        }),
      );
      await this.m.getRepository(Cliente).save(
        this.m.getRepository(Cliente).create({ idUsuario: usuario.id, ciudadResidencia: ciudad, direccionPrincipal: direccion, puntosFidelidad: 0 }),
      );
      this.clientes.push(usuario.id);
    }
  }

  private async crearProveedores(): Promise<void> {
    for (const { categorias, ...datos } of PROVEEDORES) {
      const existente = await this.m.getRepository(Proveedor).findOne({ where: { nit: datos.nit } });
      const proveedor = existente ?? (await this.m.getRepository(Proveedor).save(this.m.getRepository(Proveedor).create({ ...datos, activo: true })));
      this.proveedores.push({ proveedor, categorias });
    }
  }

  private async crearCatalogo(): Promise<void> {
    const slugs = [...new Set(PRODUCTOS.map((p) => p.categoria))];
    const categorias = await this.m.getRepository(Categoria).find({ where: { slug: In(slugs) } });
    const porSlug = new Map(categorias.map((c) => [c.slug, c]));

    for (const [indice, datos] of PRODUCTOS.entries()) {
      const categoria = porSlug.get(datos.categoria);
      if (!categoria) throw new Error(`No existe la categoria "${datos.categoria}": arranca el backend una vez para sembrar las categorias.`);

      const producto = await this.m.getRepository(Producto).save(
        this.m.getRepository(Producto).create({
          idCategoria: categoria.id,
          nombre: datos.nombre,
          descripcion: datos.descripcion,
          precio: datos.precio,
          descuentoPorcentaje: datos.descuento,
          activo: true,
        }),
      );
      this.conteo.productos += 1;

      for (const suc of this.sucursales) {
        await this.m.getRepository(ProductoSucursal).save(
          this.m.getRepository(ProductoSucursal).create({ idProducto: producto.id, idSucursal: suc.sucursal.id, activo: true }),
        );
      }

      const precioFinal = redondear(datos.precio * (1 - datos.descuento / 100));
      for (const color of datos.colores) {
        const abreviatura = sinTildes(color).split(' ').map((p) => p.slice(0, 3)).join('').toUpperCase();
        for (const talla of datos.tallas) {
          const variante = await this.m.getRepository(VarianteProducto).save(
            this.m.getRepository(VarianteProducto).create({
              idProducto: producto.id,
              sku: `DEMO-${pad(indice + 1)}-${abreviatura}-${talla}`,
              talla,
              color,
              corte: datos.corte,
              activo: true,
            }),
          );
          this.catalogo.push({ variante, producto, precioFinal, categoria: datos.categoria });
          this.conteo.variantes += 1;
        }
      }
    }
  }

  // ------------------------------------------------------------ stock y caja

  private inv(suc: SucursalDemo, item: VarianteDemo): Inventario {
    const clave = `${suc.almacen.id}:${item.variante.id}`;
    let fila = this.stock.get(clave);
    if (!fila) {
      fila = this.m.getRepository(Inventario).create({
        idAlmacen: suc.almacen.id,
        idVarianteProducto: item.variante.id,
        stockDisponible: 0,
        stockReservado: 0,
        stockMinimo: 3,
        stockMaximo: 200,
      });
      this.stock.set(clave, fila);
    }
    return fila;
  }

  private async guardarStock(): Promise<void> {
    await this.m.getRepository(Inventario).save([...this.stock.values()], { chunk: 100 });
  }

  /** Caja cerrada del dia (se crea al primer movimiento). Su saldo final se calcula al terminar. */
  private async caja(suc: SucursalDemo, dia: number): Promise<CajaDia> {
    const clave = `${suc.sucursal.id}:${dia}`;
    let registro = this.cajas.get(clave);
    if (!registro) {
      const apertura = momento(dia, 8, rnd.entero(30, 55));
      const cierre = momento(dia, 20, rnd.entero(30, 55));
      const montoInicial = rnd.elegir([500, 800, 1000]);
      const caja = await this.m.getRepository(Caja).save(
        this.m.getRepository(Caja).create({
          idSucursal: suc.sucursal.id,
          idCajero: suc.cajeros.length ? rnd.elegir(suc.cajeros) : null,
          fechaApertura: apertura,
          fechaCierre: cierre,
          horaApertura: formatearHora(apertura),
          horaCierre: formatearHora(cierre),
          montoInicial: montoInicial.toFixed(2),
          montoFinal: null,
          estado: 'Cerrada',
        }),
      );
      registro = { caja, saldo: montoInicial };
      this.cajas.set(clave, registro);
      this.conteo.cajas += 1;
    }
    return registro;
  }

  private async movimiento(suc: SucursalDemo, dia: number, tipo: 'INGRESO' | 'EGRESO', concepto: string, monto: number, fechaHora: Date): Promise<MovimientoCaja> {
    const registro = await this.caja(suc, dia);
    registro.saldo = redondear(registro.saldo + (tipo === 'INGRESO' ? monto : -monto));
    return this.m.getRepository(MovimientoCaja).save(
      this.m.getRepository(MovimientoCaja).create({ idCaja: registro.caja.id, tipo, concepto: concepto.slice(0, 150), monto: monto.toFixed(2), observaciones: null, fechaHora }),
    );
  }

  private async cerrarCajas(): Promise<void> {
    for (const { caja, saldo } of this.cajas.values()) {
      if (caja.estado !== 'Cerrada') continue;
      caja.montoFinal = saldo.toFixed(2);
      await this.m.getRepository(Caja).save(caja);
    }
  }

  /** Deja una caja abierta hoy en cada sucursal que no tenga una, para probar ventas en vivo. */
  private async abrirCajasDeHoy(): Promise<void> {
    for (const suc of this.sucursales) {
      const abierta = await this.m.getRepository(Caja).findOne({ where: { idSucursal: suc.sucursal.id, estado: 'Abierta' } });
      if (abierta) continue;
      const apertura = momento(0, 8, 30);
      await this.m.getRepository(Caja).save(
        this.m.getRepository(Caja).create({
          idSucursal: suc.sucursal.id,
          idCajero: suc.cajeros.length ? suc.cajeros[0] : null,
          fechaApertura: apertura,
          fechaCierre: null,
          horaApertura: formatearHora(apertura),
          horaCierre: null,
          montoInicial: '1000.00',
          montoFinal: null,
          estado: 'Abierta',
        }),
      );
      this.conteo.cajas += 1;
    }
  }

  // ------------------------------------------------------------ simulacion

  private programar(dia: number, accion: () => Promise<void>): void {
    if (dia < 1) return;
    const lista = this.eventos.get(dia) ?? [];
    lista.push(accion);
    this.eventos.set(dia, lista);
  }

  private async simularDia(dia: number): Promise<void> {
    if (dia === DIAS_HISTORIAL + 5) {
      for (const suc of this.sucursales) await this.compraInicial(suc, dia);
    } else if (dia % 21 === 0) {
      for (const suc of this.sucursales) await this.reposicion(suc, dia);
    }

    if (dia <= DIAS_HISTORIAL) {
      const finDeSemana = [0, 6].includes(momento(dia, 12).getDay());
      for (const suc of this.sucursales) {
        const ventas = rnd.entero(0, suc.peso > 1 ? 3 : 1) + (finDeSemana ? 1 : 0);
        for (let i = 0; i < ventas; i += 1) await this.ventaPresencial(suc, dia);
      }
      const enLinea = rnd.entero(0, 2);
      for (let i = 0; i < enLinea; i += 1) await this.ventaEnLinea(dia);
      if (dia > 3 && rnd.chance(0.35)) await this.reservaHistorica(dia);
    }

    for (const accion of this.eventos.get(dia) ?? []) await accion();
    this.eventos.delete(dia);
  }

  /** Elige 1-3 variantes distintas con stock disponible en el almacen de la sucursal. */
  private elegirLineas(suc: SucursalDemo, maxLineas = 3): Linea[] {
    const lineas: Linea[] = [];
    const cantidadLineas = rnd.entero(1, maxLineas);
    for (let intento = 0; intento < 25 && lineas.length < cantidadLineas; intento += 1) {
      const item = rnd.elegir(this.catalogo);
      if (lineas.some((l) => l.item === item)) continue;
      const cantidad = rnd.chance(0.8) ? 1 : 2;
      if (this.inv(suc, item).stockDisponible < cantidad) continue;
      lineas.push({ item, cantidad });
    }
    return lineas;
  }

  private descripcion(item: VarianteDemo): string {
    return `${item.producto.nombre} (${item.variante.talla}/${item.variante.color})`.slice(0, 255);
  }

  private total(lineas: Linea[]): number {
    return redondear(lineas.reduce((suma, l) => suma + l.item.precioFinal * l.cantidad, 0));
  }

  private async guardarDetallesVenta(nota: NotaVenta, lineas: Linea[]): Promise<void> {
    const repo = this.m.getRepository(DetalleNotaVenta);
    await repo.save(
      lineas.map((l) =>
        repo.create({
          idNotaVenta: nota.id,
          idVarianteProducto: l.item.variante.id,
          descripcion: this.descripcion(l.item),
          precioUnitario: l.item.precioFinal,
          cantidad: l.cantidad,
          subtotal: redondear(l.item.precioFinal * l.cantidad),
        }),
      ),
    );
  }

  private async nuevaNota(datos: Partial<NotaVenta>): Promise<NotaVenta> {
    const repo = this.m.getRepository(NotaVenta);
    const nota = await repo.save(repo.create({ codigoNota: provisional(), descuento: 0, impuesto: 0, montoAnticipoAplicado: 0, estadoPago: 'Pagado', nroFactura: null, nitRazonSocial: null, ...datos }));
    nota.codigoNota = codigo('NV', nota.id);
    if (rnd.chance(0.25)) {
      nota.nroFactura = `F-${pad(nota.id, 7)}`;
      nota.nitRazonSocial = String(rnd.entero(1000000, 9999999));
    }
    return repo.save(nota);
  }

  private clienteVenta(): number {
    if (this.consumidorFinal !== null && rnd.chance(0.35)) return this.consumidorFinal;
    return rnd.elegir(this.clientes);
  }

  // ------------------------------------------------------------ compras

  private async registrarCompra(suc: SucursalDemo, dia: number, proveedor: Proveedor, lineas: Linea[], pagarEnCaja: boolean): Promise<void> {
    if (lineas.length === 0) return;
    const fecha = momento(dia, 9, rnd.entero(0, 50));
    const costo = (item: VarianteDemo): number => redondear(item.producto.precio * 0.45);
    const total = redondear(lineas.reduce((suma, l) => suma + costo(l.item) * l.cantidad, 0));
    const repo = this.m.getRepository(NotaCompra);
    const nroFactura = `FC-${proveedor.nit.slice(-4)}-${pad(this.conteo.compras + 1, 4)}`;
    const compra = await repo.save(
      repo.create({
        idProveedor: proveedor.id,
        idSucursal: suc.sucursal.id,
        idMovimientoCaja: null,
        nroFactura,
        fechaEmision: fecha,
        fechaEntregaProgramada: formatearFecha(fecha),
        fechaPago: null,
        subtotal: total.toFixed(2),
        total: total.toFixed(2),
        estado: 'Recibido',
      }),
    );
    const detalleRepo = this.m.getRepository(DetalleNotaCompra);
    await detalleRepo.save(
      lineas.map((l) =>
        detalleRepo.create({
          idNotaCompra: compra.id,
          idVarianteProducto: l.item.variante.id,
          idAlmacen: suc.almacen.id,
          precioUnitario: costo(l.item).toFixed(2),
          cantidad: l.cantidad,
          subtotal: redondear(costo(l.item) * l.cantidad).toFixed(2),
          nroLote: `L${formatearFecha(fecha).replace(/-/g, '')}`,
        }),
      ),
    );
    for (const l of lineas) this.inv(suc, l.item).stockDisponible += l.cantidad;

    if (pagarEnCaja) {
      const mov = await this.movimiento(suc, dia, 'EGRESO', `Compra ${nroFactura} - ${proveedor.empresa}`, total, fecha);
      compra.idMovimientoCaja = mov.id;
      compra.fechaPago = formatearFecha(fecha);
    } else {
      // Pagada por transferencia unos dias despues (no pasa por caja).
      const pago = new Date(fecha);
      pago.setDate(pago.getDate() + rnd.entero(3, 10));
      compra.fechaPago = pago <= HOY ? formatearFecha(pago) : null;
    }
    await repo.save(compra);
    this.conteo.compras += 1;
  }

  private async compraInicial(suc: SucursalDemo, dia: number): Promise<void> {
    for (const { proveedor, categorias } of this.proveedores) {
      const lineas = this.catalogo
        .filter((item) => categorias.includes(item.categoria))
        .map((item) => ({ item, cantidad: suc.peso > 1 ? rnd.entero(10, 18) : rnd.entero(5, 9) }));
      await this.registrarCompra(suc, dia, proveedor, lineas, false);
    }
  }

  private async reposicion(suc: SucursalDemo, dia: number): Promise<void> {
    for (const { proveedor, categorias } of this.proveedores) {
      const lineas = this.catalogo
        .filter((item) => categorias.includes(item.categoria) && this.inv(suc, item).stockDisponible < 5)
        .map((item) => ({ item, cantidad: suc.peso > 1 ? 10 : 6 }));
      if (lineas.length === 0) continue;
      const caja = await this.caja(suc, dia);
      const total = lineas.reduce((suma, l) => suma + l.item.producto.precio * 0.45 * l.cantidad, 0);
      await this.registrarCompra(suc, dia, proveedor, lineas, caja.saldo >= total);
    }
  }

  // ------------------------------------------------------------ ventas

  private async ventaPresencial(suc: SucursalDemo, dia: number): Promise<void> {
    const lineas = this.elegirLineas(suc);
    if (lineas.length === 0) return;
    const fecha = horaComercial(dia);
    const total = this.total(lineas);
    const pasarela = this.pasarelas.get(rnd.siguiente() < 0.55 ? 'EFECTIVO' : rnd.chance(0.65) ? 'QR' : 'TARJETA') as PasarelaPago;

    const nota = await this.nuevaNota({
      idCliente: this.clienteVenta(),
      idCajero: suc.cajeros.length ? rnd.elegir(suc.cajeros) : null,
      idSucursal: suc.sucursal.id,
      idPasarela: pasarela.id,
      idMovimientoCaja: null,
      idCarrito: null,
      idReserva: null,
      tipo: 'PRESENCIAL',
      tipoVenta: 'DIRECTA_PRESENCIAL',
      fechaEmision: formatearFecha(fecha),
      horaEmision: formatearHora(fecha),
      subtotal: total,
      montoTotal: total,
    });
    const mov = await this.movimiento(suc, dia, 'INGRESO', `Venta presencial ${nota.codigoNota}`, total, fecha);
    nota.idMovimientoCaja = mov.id;
    await this.m.getRepository(NotaVenta).save(nota);
    await this.guardarDetallesVenta(nota, lineas);
    for (const l of lineas) this.inv(suc, l.item).stockDisponible -= l.cantidad;
    await this.pago({ idMovimientoCaja: mov.id, idPasarela: pasarela.id, idNotaVenta: nota.id, monto: total, concepto: 'PAGO_TOTAL' }, fecha);

    this.conteo.ventasPresenciales += 1;
    this.registrarDevolvible({ nota, lineas, dia, suc });
  }

  private async carritoDe(idCliente: number, suc: SucursalDemo): Promise<Carrito> {
    let carrito = this.carritos.get(idCliente) ?? (await this.m.getRepository(Carrito).findOne({ where: { idCliente } }));
    if (!carrito) {
      carrito = await this.m.getRepository(Carrito).save(
        this.m.getRepository(Carrito).create({ idCliente, idSucursal: suc.sucursal.id, sessionId: null }),
      );
    }
    this.carritos.set(idCliente, carrito);
    return carrito;
  }

  private async ventaEnLinea(dia: number): Promise<void> {
    const suc = this.elegirSucursal();
    const lineas = this.elegirLineas(suc, 2);
    if (lineas.length === 0) return;
    const fecha = momento(dia, rnd.entero(7, 23), rnd.entero(0, 59));
    const total = this.total(lineas);
    const idCliente = rnd.elegir(this.clientes);
    const carrito = await this.carritoDe(idCliente, suc);
    const enLinea = ['QR', 'STRIPE', 'TARJETA'].filter((c) => this.pasarelas.get(c)?.disponibleLinea);
    const codigoPasarela = rnd.elegir(enLinea.length ? enLinea : ['QR']);
    const pasarela = this.pasarelas.get(codigoPasarela) as PasarelaPago;

    const nota = await this.nuevaNota({
      idCliente,
      idCajero: null,
      idSucursal: suc.sucursal.id,
      idPasarela: pasarela.id,
      idMovimientoCaja: null,
      idCarrito: carrito.id,
      idReserva: null,
      tipo: 'ONLINE',
      tipoVenta: 'E_COMMERCE',
      fechaEmision: formatearFecha(fecha),
      horaEmision: formatearHora(fecha),
      subtotal: total,
      montoTotal: total,
    });
    await this.guardarDetallesVenta(nota, lineas);
    for (const l of lineas) this.inv(suc, l.item).stockDisponible -= l.cantidad;
    await this.pago({ idMovimientoCaja: null, idPasarela: pasarela.id, idNotaVenta: nota.id, monto: total, concepto: 'PAGO_TOTAL', referenciaExterna: this.referencia(codigoPasarela) }, fecha);

    this.conteo.ventasEnLinea += 1;
    this.registrarDevolvible({ nota, lineas, dia, suc });
  }

  private referencia(codigoPasarela: string): string {
    const uuid = randomUUID();
    return codigoPasarela === 'STRIPE' ? `cs_test_${uuid.replace(/-/g, '')}` : `${codigoPasarela}:${uuid}`;
  }

  private async pago(datos: Partial<Pago>, fecha: Date): Promise<void> {
    const repo = this.m.getRepository(Pago);
    await repo.save(repo.create({ idNotaVenta: null, idReserva: null, referenciaExterna: null, ...datos, fechaPago: formatearFecha(fecha), horaPago: formatearHora(fecha) }));
  }

  // ------------------------------------------------------------ reservas

  private elegirClienteReserva(): number | null {
    const libres = this.clientes.filter((id) => (this.reservasActivasPorCliente.get(id) ?? 0) < 2);
    return libres.length ? rnd.elegir(libres) : null;
  }

  private async nuevaReserva(suc: SucursalDemo, idCliente: number, lineas: Linea[], creada: Date, horasLimite: number, conAnticipo: boolean, diaCreacion: number): Promise<{ reserva: Reserva; anticipo: number }> {
    const total = this.total(lineas);
    const anticipo = redondear(total * rnd.elegir([0.2, 0.3, 0.5]));
    const repo = this.m.getRepository(Reserva);
    const reserva = await repo.save(
      repo.create({
        codigoReserva: provisional(),
        idCliente,
        idSucursal: suc.sucursal.id,
        fechaReserva: creada,
        fechaLimite: new Date(creada.getTime() + horasLimite * 3600 * 1000),
        estado: conAnticipo ? 'PAGADA' : 'PENDIENTE',
        montoAnticipo: anticipo,
        montoTotal: total,
        observaciones: rnd.chance(0.3) ? rnd.elegir(['Pasa a recoger el fin de semana', 'Consultar si llega en otra talla', 'Prueba en tienda antes de llevar']) : null,
      }),
    );
    reserva.codigoReserva = codigo('RS', reserva.id);
    await repo.save(reserva);

    const detalleRepo = this.m.getRepository(DetalleReserva);
    await detalleRepo.save(
      lineas.map((l) =>
        detalleRepo.create({ idReserva: reserva.id, idVarianteProducto: l.item.variante.id, precioUnitario: l.item.precioFinal, cantidad: l.cantidad, subtotal: redondear(l.item.precioFinal * l.cantidad) }),
      ),
    );
    for (const l of lineas) {
      const fila = this.inv(suc, l.item);
      fila.stockDisponible -= l.cantidad;
      fila.stockReservado += l.cantidad;
    }

    if (conAnticipo) {
      const fechaPago = new Date(creada.getTime() + rnd.entero(5, 120) * 60 * 1000);
      if (rnd.chance(0.5)) {
        await this.pago({ idMovimientoCaja: null, idPasarela: this.pasarelas.get('QR')?.id ?? null, idReserva: reserva.id, monto: anticipo, concepto: 'ANTICIPO_RESERVA', referenciaExterna: this.referencia('QR') }, fechaPago);
      } else {
        const pasarela = this.pasarelas.get(rnd.chance(0.6) ? 'EFECTIVO' : 'QR') as PasarelaPago;
        const mov = await this.movimiento(suc, diaCreacion, 'INGRESO', `Anticipo reserva ${reserva.codigoReserva}`, anticipo, fechaPago);
        await this.pago({ idMovimientoCaja: mov.id, idPasarela: pasarela.id, idReserva: reserva.id, monto: anticipo, concepto: 'ANTICIPO_RESERVA' }, fechaPago);
      }
    }
    this.conteo.reservas += 1;
    return { reserva, anticipo };
  }

  /** Reserva pasada: termina COMPLETADA (liquidada) o CANCELADA (manual o por vencimiento). */
  private async reservaHistorica(dia: number): Promise<void> {
    const suc = this.elegirSucursal();
    const idCliente = rnd.elegir(this.clientes);
    const lineas = this.elegirLineas(suc, 2);
    if (lineas.length === 0) return;
    const creada = horaComercial(dia);
    const destino = rnd.siguiente();
    const conAnticipo = destino < 0.65 || rnd.chance(0.5);
    const { reserva, anticipo } = await this.nuevaReserva(suc, idCliente, lineas, creada, 48, conAnticipo, dia);

    if (destino < 0.65) {
      const diaLiquidacion = dia - rnd.entero(0, 2);
      this.programar(diaLiquidacion, () => this.liquidar(reserva, suc, lineas, anticipo, conAnticipo, diaLiquidacion));
    } else {
      const porVencimiento = rnd.chance(0.6);
      const diaCancelacion = porVencimiento ? dia - 2 : dia - rnd.entero(0, 1);
      this.programar(diaCancelacion, async () => {
        for (const l of lineas) {
          const fila = this.inv(suc, l.item);
          fila.stockReservado -= l.cantidad;
          fila.stockDisponible += l.cantidad;
        }
        reserva.estado = 'CANCELADA';
        reserva.observaciones = [reserva.observaciones, porVencimiento ? '[Cancelada automaticamente por vencimiento]' : '[Cancelada manualmente]'].filter(Boolean).join(' ');
        await this.m.getRepository(Reserva).save(reserva);
        if (conAnticipo && !porVencimiento && rnd.chance(0.7)) {
          await this.devolucionAnticipo(reserva, suc, anticipo, diaCancelacion);
        }
      });
    }
  }

  private async liquidar(reserva: Reserva, suc: SucursalDemo, lineas: Linea[], anticipo: number, anticipoPagado: boolean, diaLiquidacion: number): Promise<void> {
    let fecha = horaComercial(diaLiquidacion);
    if (fecha <= reserva.fechaReserva) fecha = new Date(reserva.fechaReserva.getTime() + 90 * 60 * 1000);
    const aplicado = anticipoPagado ? anticipo : 0;
    const saldo = redondear(Number(reserva.montoTotal) - aplicado);
    const pasarela = this.pasarelas.get(rnd.chance(0.6) ? 'EFECTIVO' : 'QR') as PasarelaPago;

    const nota = await this.nuevaNota({
      idCliente: reserva.idCliente,
      idCajero: suc.cajeros.length ? rnd.elegir(suc.cajeros) : null,
      idSucursal: suc.sucursal.id,
      idPasarela: saldo > 0 ? pasarela.id : null,
      idMovimientoCaja: null,
      idCarrito: null,
      idReserva: reserva.id,
      tipo: 'PRESENCIAL',
      tipoVenta: 'PRESENCIAL_LIQUIDACION',
      fechaEmision: formatearFecha(fecha),
      horaEmision: formatearHora(fecha),
      subtotal: Number(reserva.montoTotal),
      montoAnticipoAplicado: aplicado,
      montoTotal: Number(reserva.montoTotal),
    });
    await this.guardarDetallesVenta(nota, lineas);
    for (const l of lineas) this.inv(suc, l.item).stockReservado -= l.cantidad;

    if (saldo > 0) {
      const mov = await this.movimiento(suc, diaLiquidacion, 'INGRESO', `Saldo reserva ${reserva.codigoReserva}`, saldo, fecha);
      nota.idMovimientoCaja = mov.id;
      await this.m.getRepository(NotaVenta).save(nota);
      await this.pago({ idMovimientoCaja: mov.id, idPasarela: pasarela.id, idNotaVenta: nota.id, idReserva: reserva.id, monto: saldo, concepto: 'SALDO_LIQUIDACION' }, fecha);
    }
    reserva.estado = 'COMPLETADA';
    await this.m.getRepository(Reserva).save(reserva);
    this.conteo.liquidaciones += 1;
    this.registrarDevolvible({ nota, lineas, dia: diaLiquidacion, suc });
  }

  /** Reservas vigentes para probar cobrar anticipo, liquidar o cancelar desde la app. */
  private async crearReservasActivas(): Promise<void> {
    for (let i = 0; i < 8; i += 1) {
      const idCliente = this.elegirClienteReserva();
      if (idCliente === null) break;
      const suc = i % 3 === 2 && this.sucursales.length > 1 ? this.sucursales[1] : this.sucursales[0];
      const lineas = this.elegirLineas(suc, 2);
      if (lineas.length === 0) continue;
      const creada = new Date(Date.now() - rnd.entero(1, 20) * 3600 * 1000);
      // Limite holgado (48h desde ahora) para que no se venzan antes de probarlas.
      const horas = Math.ceil((Date.now() - creada.getTime()) / 3600000) + 48;
      const diaCreacion = creada < HOY ? 1 : 0;
      const conAnticipo = i % 2 === 0;
      if (conAnticipo && diaCreacion === 0) {
        // El anticipo cobrado hoy iria a la caja abierta; para no tocarla se cobra en linea.
        await this.nuevaReservaEnLinea(suc, idCliente, lineas, creada, horas);
      } else {
        await this.nuevaReserva(suc, idCliente, lineas, creada, horas, conAnticipo, Math.max(diaCreacion, 1));
      }
      this.reservasActivasPorCliente.set(idCliente, (this.reservasActivasPorCliente.get(idCliente) ?? 0) + 1);
    }
  }

  private async nuevaReservaEnLinea(suc: SucursalDemo, idCliente: number, lineas: Linea[], creada: Date, horas: number): Promise<void> {
    const { reserva } = await this.nuevaReserva(suc, idCliente, lineas, creada, horas, false, 1);
    const fechaPago = new Date(creada.getTime() + 10 * 60 * 1000);
    await this.pago({ idMovimientoCaja: null, idPasarela: this.pasarelas.get('QR')?.id ?? null, idReserva: reserva.id, monto: Number(reserva.montoAnticipo), concepto: 'ANTICIPO_RESERVA', referenciaExterna: this.referencia('QR') }, fechaPago);
    reserva.estado = 'PAGADA';
    await this.m.getRepository(Reserva).save(reserva);
  }

  // ------------------------------------------------------------ devoluciones

  private registrarDevolvible(venta: VentaHecha): void {
    if (!rnd.chance(0.06)) return;
    const diaDevolucion = venta.dia - rnd.entero(1, 6);
    this.programar(diaDevolucion, () => this.devolucionProducto(venta, diaDevolucion));
  }

  private async nuevaDevolucion(datos: Partial<NotaDevolucion>): Promise<NotaDevolucion> {
    const repo = this.m.getRepository(NotaDevolucion);
    const devolucion = await repo.save(repo.create({ codigoDevolucion: provisional(), ...datos }));
    devolucion.codigoDevolucion = codigo('DV', devolucion.id);
    this.conteo.devoluciones += 1;
    return repo.save(devolucion);
  }

  private async devolucionProducto(venta: VentaHecha, dia: number): Promise<void> {
    const { nota, suc } = venta;
    const linea = rnd.elegir(venta.lineas);
    const motivo = rnd.elegir<MotivoDevolucion>(['FALLA_FABRICA', 'TALLA_INCORRECTA', 'TALLA_INCORRECTA', 'ARREPENTIMIENTO']);
    const reingresa = motivo !== 'FALLA_FABRICA';
    const monto = linea.item.precioFinal;
    const fecha = horaComercial(dia);
    const efectivo = this.pasarelas.get('EFECTIVO') as PasarelaPago;
    const idCajero = suc.cajeros.length ? rnd.elegir(suc.cajeros) : null;
    if (idCajero === null) return;

    const mov = await this.movimiento(suc, dia, 'EGRESO', `Reembolso devolucion ${nota.codigoNota}`, monto, fecha);
    const devolucion = await this.nuevaDevolucion({
      idCliente: nota.idCliente,
      idSucursal: suc.sucursal.id,
      idCajero,
      idNotaVenta: nota.id,
      idReserva: null,
      idMovimientoCaja: mov.id,
      tipoDevolucion: 'PRODUCTO_ENTREGADO',
      motivoDevolucion: motivo,
      montoTotalReembolsado: monto,
      observaciones: motivo === 'FALLA_FABRICA' ? 'Costura abierta, prenda descartada' : motivo === 'TALLA_INCORRECTA' ? 'Cliente pidio otra talla' : null,
      fechaEmision: fecha,
    });
    await this.m.getRepository(DetalleNotaDevolucion).save(
      this.m.getRepository(DetalleNotaDevolucion).create({
        idNotaDevolucion: devolucion.id,
        idVarianteProducto: linea.item.variante.id,
        idAlmacen: reingresa ? suc.almacen.id : null,
        descripcion: this.descripcion(linea.item),
        precioUnitario: monto,
        cantidad: 1,
        montoSubtotal: monto,
        estadoProducto: reingresa ? 'REINGRESO_INVENTARIO' : 'MERMA_DEFECTUOSO',
      }),
    );
    if (reingresa) this.inv(suc, linea.item).stockDisponible += 1;
    await this.pago({ idMovimientoCaja: mov.id, idPasarela: efectivo.id, idNotaVenta: nota.id, monto, concepto: 'REEMBOLSO' }, fecha);
  }

  private async devolucionAnticipo(reserva: Reserva, suc: SucursalDemo, anticipo: number, dia: number): Promise<void> {
    const idCajero = suc.cajeros.length ? rnd.elegir(suc.cajeros) : null;
    if (idCajero === null) return;
    const fecha = horaComercial(dia);
    const efectivo = this.pasarelas.get('EFECTIVO') as PasarelaPago;
    const mov = await this.movimiento(suc, dia, 'EGRESO', `Reembolso devolucion ${reserva.codigoReserva}`, anticipo, fecha);
    const devolucion = await this.nuevaDevolucion({
      idCliente: reserva.idCliente,
      idSucursal: suc.sucursal.id,
      idCajero,
      idNotaVenta: null,
      idReserva: reserva.id,
      idMovimientoCaja: mov.id,
      tipoDevolucion: 'CANCELACION_RESERVA',
      motivoDevolucion: 'CANCELACION',
      montoTotalReembolsado: anticipo,
      observaciones: 'El cliente desistio de la reserva',
      fechaEmision: fecha,
    });
    await this.m.getRepository(DetalleNotaDevolucion).save(
      this.m.getRepository(DetalleNotaDevolucion).create({
        idNotaDevolucion: devolucion.id,
        idVarianteProducto: null,
        idAlmacen: null,
        descripcion: `Reembolso del anticipo de la reserva ${reserva.codigoReserva}`,
        precioUnitario: anticipo,
        cantidad: 1,
        montoSubtotal: anticipo,
        estadoProducto: 'NO_APLICA',
      }),
    );
    await this.pago({ idMovimientoCaja: mov.id, idPasarela: efectivo.id, idReserva: reserva.id, monto: anticipo, concepto: 'REEMBOLSO' }, fecha);
  }

  // ------------------------------------------------------------ carritos

  /** Algunos clientes dejan productos en el carrito para probar el checkout. */
  private async crearCarritosConProductos(): Promise<void> {
    const repo = this.m.getRepository(DetalleCarrito);
    for (const idCliente of this.clientes.slice(0, 5)) {
      const suc = this.sucursales[0];
      const carrito = await this.carritoDe(idCliente, suc);
      const ocupadas = new Set((await repo.find({ where: { idCarrito: carrito.id } })).map((d) => d.idVarianteProducto));
      for (const l of this.elegirLineas(suc, 3)) {
        if (ocupadas.has(l.item.variante.id)) continue;
        await repo.save(
          repo.create({
            idCarrito: carrito.id,
            idVarianteProducto: l.item.variante.id,
            precioUnitario: l.item.precioFinal.toFixed(2),
            cantidad: l.cantidad,
            subtotal: redondear(l.item.precioFinal * l.cantidad).toFixed(2),
            notasEspeciales: null,
          }),
        );
      }
    }
  }
}

// ---------------------------------------------------------------- entrada

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
try {
  const dataSource = app.get(DataSource);
  const yaSembrado = await dataSource.getRepository(Usuario).count({ where: { email: Like(`%@${DOMINIO_DEMO}`) } });
  if (yaSembrado > 0) {
    console.log(`Los datos demo ya estan cargados (${yaSembrado} clientes @${DOMINIO_DEMO}). No se agrego nada.`);
  } else {
    const conteo = await dataSource.transaction((manager) => new DemoSeeder(manager).run());
    console.log('Datos demo cargados:');
    console.table(conteo);
    console.log(`Clientes demo: <nombre>.<apellido>@${DOMINIO_DEMO} (contrasena en DEMO_PASSWORD de demo-data.seeder.ts)`);
  }
} finally {
  await app.close();
}

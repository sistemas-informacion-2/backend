import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import type { EntityManager } from 'typeorm';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { Usuario } from '../../acceso/entities/usuario.entity.js';
import { Cliente } from '../../operaciones/entities/cliente.entity.js';
import { PasarelaPago } from '../entities/pasarela-pago.entity.js';
import { VarianteProducto } from '../../inventario/entities/variante-producto.entity.js';
import { Inventario } from '../../inventario/entities/inventario.entity.js';
import { Caja } from '../entities/caja.entity.js';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';
import { Almacen } from '../../inventario/entities/almacen.entity.js';
import { ProductoSucursal } from '../../inventario/entities/producto-sucursal.entity.js';
import { DetalleNotaVenta } from '../entities/detalle-nota-venta.entity.js';
import { NotaVentaRepository } from '../repositories/nota-venta.repository.js';
import { PagoRepository } from '../repositories/pago.repository.js';
import { MovimientoCajaRepository } from '../repositories/movimiento-caja.repository.js';
import { toVentaResponseDto } from '../mappers/venta.mapper.js';
import type { CrearVentaDto } from '../dto/crear-venta.dto.js';
import type { VentasQueryDto } from '../dto/ventas-query.dto.js';
import type { PaginacionClienteQueryDto } from '../dto/paginacion-cliente-query.dto.js';
import type { VentaPaginatedResponseDto, VentaResponseDto } from '../dto/venta-response.dto.js';

/**
 * NOTA_VENTA.id_cliente es obligatorio, pero en una venta de mostrador no se pide registrar al comprador. Esas ventas
 * se asocian a este cliente generico, que no puede iniciar sesion (cuenta inactiva y sin contrasena conocida).
 */
export const EMAIL_CONSUMIDOR_FINAL = 'consumidor.final@fashionstore.local';

/** Parte de una linea que sale de un almacen concreto: una linea puede repartirse entre varios almacenes. */
interface Asignacion {
  inventario: Inventario;
  cantidad: number;
}

interface LineaVenta {
  idVarianteProducto: number;
  descripcion: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
  asignaciones: Asignacion[];
}

@Injectable()
export class VentasService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notaVentaRepo: NotaVentaRepository,
    private readonly pagoRepo: PagoRepository,
    private readonly movimientoCajaRepo: MovimientoCajaRepository,
  ) {}

  async listar(query: VentasQueryDto): Promise<VentaPaginatedResponseDto> {
    // Las ventas de la tienda en linea tienen su propia pantalla (VentasEnLineaService).
    const { items, total } = await this.notaVentaRepo.findPage({ ...query, excluirTipoVenta: 'E_COMMERCE' });
    return {
      items: items.map(toVentaResponseDto),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /** Compras del cliente autenticado (nunca de otro: el id sale del token). */
  async listarPropias(query: PaginacionClienteQueryDto, usuario: ActiveUser): Promise<VentaPaginatedResponseDto> {
    const { items, total } = await this.notaVentaRepo.findPage({ page: query.page, limit: query.limit, idCliente: this.idCliente(usuario) });
    return {
      items: items.map(toVentaResponseDto),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async obtenerPropia(id: number, usuario: ActiveUser): Promise<VentaResponseDto> {
    const venta = await this.notaVentaRepo.findByIdConDetalle(id);
    // Una compra ajena es indistinguible de una inexistente.
    if (!venta || venta.idCliente !== this.idCliente(usuario)) throw new NotFoundException('Compra no encontrada');
    return toVentaResponseDto(venta);
  }

  private idCliente(usuario: ActiveUser): number {
    if (usuario.tipoUsuario !== 'C') throw new ForbiddenException('Solo los clientes tienen compras propias');
    return usuario.sub;
  }

  async obtener(id: number): Promise<VentaResponseDto> {
    const venta = await this.notaVentaRepo.findByIdConDetalle(id);
    if (!venta) throw new NotFoundException('Venta no encontrada');
    return toVentaResponseDto(venta);
  }

  async crear(dto: CrearVentaDto, usuario: ActiveUser): Promise<VentaResponseDto> {
    const idSucursal = usuario.tipoUsuario === 'E' ? usuario.sucursalId : dto.idSucursal;
    if (!idSucursal) throw new BadRequestException('No se pudo determinar la sucursal de la venta');

    const id = await this.dataSource.transaction(async (manager) => {
      // El cliente es opcional: sin el, la venta queda a nombre del consumidor final.
      const idCliente = dto.idCliente ?? (await this.obtenerConsumidorFinal(manager));
      if (dto.idCliente !== undefined) await this.validarCliente(manager, dto.idCliente);
      await this.validarSucursal(manager, idSucursal);
      const caja = await this.obtenerCajaAbierta(manager, idSucursal);
      await this.validarPasarela(manager, dto.idPasarela);

      // El cajero no elige almacen: el stock sale de los almacenes activos de la sucursal de la venta.
      const lineas = await this.construirLineas(manager, idSucursal, consolidarItems(dto.items));

      const subtotal = redondear(lineas.reduce((total, linea) => total + linea.subtotal, 0));
      const descuento = redondear(dto.descuento ?? 0);
      const impuesto = redondear(dto.impuesto ?? 0);
      if (descuento > subtotal) throw new BadRequestException('El descuento no puede superar el subtotal');
      const montoTotal = redondear(subtotal - descuento + impuesto);
      if (montoTotal < 0) throw new BadRequestException('El total de la venta no puede ser negativo');

      const ahora = new Date();
      const secuencia = (await this.notaVentaRepo.count(manager)) + 1;
      const codigoNota = `NV-${String(secuencia).padStart(6, '0')}`;

      const movimiento = this.movimientoCajaRepo.create(
        {
          idCaja: caja.id,
          tipo: 'INGRESO',
          concepto: `Venta presencial ${codigoNota}`,
          monto: montoTotal.toFixed(2),
          observaciones: null,
          fechaHora: ahora,
        },
        manager,
      );
      await this.movimientoCajaRepo.save(movimiento, manager);

      const venta = this.notaVentaRepo.create(
        {
          codigoNota,
          idCliente,
          idCajero: usuario.tipoUsuario === 'E' ? usuario.sub : null,
          idSucursal,
          idPasarela: dto.idPasarela,
          idMovimientoCaja: movimiento.id,
          tipo: 'PRESENCIAL',
          tipoVenta: 'DIRECTA_PRESENCIAL',
          nroFactura: dto.nroFactura?.trim() || null,
          nitRazonSocial: dto.nitRazonSocial?.trim() || null,
          fechaEmision: formatearFecha(ahora),
          horaEmision: formatearHora(ahora),
          subtotal,
          montoAnticipoAplicado: 0,
          descuento,
          impuesto,
          montoTotal,
          estadoPago: 'Pagado',
        },
        manager,
      );
      await this.notaVentaRepo.save(venta, manager);

      const detalleRepo = manager.getRepository(DetalleNotaVenta);
      const inventarioRepo = manager.getRepository(Inventario);
      for (const linea of lineas) {
        await detalleRepo.save(
          detalleRepo.create({
            idNotaVenta: venta.id,
            idVarianteProducto: linea.idVarianteProducto,
            descripcion: linea.descripcion,
            precioUnitario: linea.precioUnitario,
            cantidad: linea.cantidad,
            subtotal: linea.subtotal,
          }),
        );

        for (const { inventario, cantidad } of linea.asignaciones) {
          inventario.stockDisponible -= cantidad;
          await inventarioRepo.save(inventario);
        }
      }

      await this.pagoRepo.save(
        this.pagoRepo.create(
          {
            idMovimientoCaja: movimiento.id,
            idPasarela: dto.idPasarela,
            idNotaVenta: venta.id,
            monto: montoTotal,
            concepto: 'PAGO_TOTAL',
            fechaPago: formatearFecha(ahora),
            horaPago: formatearHora(ahora),
          },
          manager,
        ),
        manager,
      );

      return venta.id;
    });

    return this.obtener(id);
  }

  /**
   * Devuelve el id del cliente generico "Consumidor Final", creandolo la primera vez. Va dentro de la transaccion de la
   * venta: si dos primeras ventas coinciden, una falla por el correo unico y basta con repetirla (no se cobra nada).
   */
  private async obtenerConsumidorFinal(manager: EntityManager): Promise<number> {
    const usuarioRepo = manager.getRepository(Usuario);
    let usuario = await usuarioRepo.findOne({ where: { email: EMAIL_CONSUMIDOR_FINAL } });
    if (!usuario) {
      usuario = await usuarioRepo.save(
        usuarioRepo.create({
          nombre: 'Consumidor',
          apellido: 'Final',
          email: EMAIL_CONSUMIDOR_FINAL,
          telefono: null,
          sexo: null,
          passwordHash: await bcrypt.hash(randomUUID(), 10),
          tipoUsuario: 'C',
          estadoAcceso: 'SUSPENDIDO',
          intentosFallidos: 0,
          activo: false,
        }),
      );
    }

    const clienteRepo = manager.getRepository(Cliente);
    const cliente = await clienteRepo.findOne({ where: { idUsuario: usuario.id } });
    if (!cliente) {
      await clienteRepo.save(clienteRepo.create({ idUsuario: usuario.id, ciudadResidencia: null, direccionPrincipal: null, puntosFidelidad: 0 }));
    }
    return usuario.id;
  }

  private async validarCliente(manager: EntityManager, idCliente: number): Promise<void> {
    const cliente = await manager.getRepository(Cliente).findOne({ where: { idUsuario: idCliente } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
  }

  private async validarSucursal(manager: EntityManager, idSucursal: number): Promise<void> {
    const sucursal = await manager.getRepository(Sucursal).findOne({ where: { id: idSucursal } });
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');
    if (!sucursal.activo) throw new ConflictException('La sucursal esta inactiva');
  }

  private async obtenerCajaAbierta(manager: EntityManager, idSucursal: number): Promise<Caja> {
    const caja = await manager.getRepository(Caja).findOne({ where: { idSucursal, estado: 'Abierta' } });
    if (!caja) throw new ConflictException('La sucursal no tiene una caja abierta');
    return caja;
  }

  private async validarPasarela(manager: EntityManager, idPasarela: number): Promise<void> {
    const pasarela = await manager.getRepository(PasarelaPago).findOne({ where: { id: idPasarela } });
    if (!pasarela) throw new NotFoundException('Metodo de pago no encontrado');
    if (!pasarela.disponiblePresencial) {
      throw new BadRequestException('El metodo de pago no esta habilitado para caja');
    }
  }

  /**
   * Cada linea toma su stock de los almacenes activos de la sucursal (INVENTARIO cuelga de ALMACEN -> SUCURSAL),
   * empezando por el que mas tiene para no partir la venta entre muchos almacenes. El producto debe estar
   * activo en la sucursal (PRODUCTO_SUCURSAL), igual que para comprar y reservar.
   */
  private async construirLineas(
    manager: EntityManager,
    idSucursal: number,
    items: Array<{ idVarianteProducto: number; cantidad: number }>,
  ): Promise<LineaVenta[]> {
    const varianteRepo = manager.getRepository(VarianteProducto);
    const almacenes = await manager.getRepository(Almacen).find({ where: { idSucursal, activo: true }, select: { id: true } });
    const lineas: LineaVenta[] = [];

    for (const item of items) {
      const variante = await varianteRepo.findOne({
        where: { id: item.idVarianteProducto },
        relations: { producto: true },
      });
      if (!variante) throw new NotFoundException(`Variante ${item.idVarianteProducto} no encontrada`);
      if (!variante.activo || !variante.producto?.activo) {
        throw new ConflictException(`La variante ${variante.sku} ya no esta disponible`);
      }
      const activado = await manager.getRepository(ProductoSucursal).findOne({
        where: { idSucursal, idProducto: variante.idProducto, activo: true },
      });
      if (!activado) throw new ConflictException(`"${variante.producto.nombre}" no se vende en esta sucursal`);

      const inventarios =
        almacenes.length === 0
          ? []
          : await manager.getRepository(Inventario).find({
              where: { idAlmacen: In(almacenes.map((almacen) => almacen.id)), idVarianteProducto: variante.id },
              order: { idAlmacen: 'ASC' },
              lock: { mode: 'pessimistic_write' },
            });

      const asignaciones: Asignacion[] = [];
      let restante = item.cantidad;
      for (const inventario of [...inventarios].sort((a, b) => b.stockDisponible - a.stockDisponible || a.id - b.id)) {
        if (restante === 0) break;
        const tomar = Math.min(inventario.stockDisponible, restante);
        if (tomar <= 0) continue;
        asignaciones.push({ inventario, cantidad: tomar });
        restante -= tomar;
      }
      if (restante > 0) throw new BadRequestException(`Stock insuficiente para la variante ${variante.sku}`);

      const precioUnitario = Number(variante.producto?.precio ?? 0);
      lineas.push({
        idVarianteProducto: variante.id,
        descripcion: `${variante.producto?.nombre ?? 'Producto'} (${variante.talla}/${variante.color})`,
        precioUnitario,
        cantidad: item.cantidad,
        subtotal: redondear(precioUnitario * item.cantidad),
        asignaciones,
      });
    }

    return lineas;
  }
}

/** Une lineas repetidas de la misma variante y las ordena para bloquear filas siempre en el mismo orden. */
function consolidarItems(items: CrearVentaDto['items']): Array<{ idVarianteProducto: number; cantidad: number }> {
  const porVariante = new Map<number, number>();
  for (const item of items) {
    porVariante.set(item.idVarianteProducto, (porVariante.get(item.idVarianteProducto) ?? 0) + item.cantidad);
  }
  return [...porVariante.entries()]
    .map(([idVarianteProducto, cantidad]) => ({ idVarianteProducto, cantidad }))
    .sort((a, b) => a.idVarianteProducto - b.idVarianteProducto);
}

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

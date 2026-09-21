import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { Cliente } from '../../operaciones/entities/cliente.entity.js';
import { PasarelaPago } from '../entities/pasarela-pago.entity.js';
import { VarianteProducto } from '../../inventario/entities/variante-producto.entity.js';
import { Inventario } from '../../inventario/entities/inventario.entity.js';
import { Caja } from '../entities/caja.entity.js';
import { DetalleNotaVenta } from '../entities/detalle-nota-venta.entity.js';
import { NotaVentaRepository } from '../repositories/nota-venta.repository.js';
import { PagoRepository } from '../repositories/pago.repository.js';
import { MovimientoCajaRepository } from '../repositories/movimiento-caja.repository.js';
import { toVentaResponseDto } from '../mappers/venta.mapper.js';
import type { CrearVentaDto } from '../dto/crear-venta.dto.js';
import type { VentasQueryDto } from '../dto/ventas-query.dto.js';
import type { VentaPaginatedResponseDto, VentaResponseDto } from '../dto/venta-response.dto.js';

interface LineaVenta {
  idVarianteProducto: number;
  descripcion: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
  inventario: Inventario;
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
    const { items, total } = await this.notaVentaRepo.findPage(query);
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

  async obtener(id: number): Promise<VentaResponseDto> {
    const venta = await this.notaVentaRepo.findByIdConDetalle(id);
    if (!venta) throw new NotFoundException('Venta no encontrada');
    return toVentaResponseDto(venta);
  }

  async crear(dto: CrearVentaDto, usuario: ActiveUser): Promise<VentaResponseDto> {
    const idSucursal = usuario.tipoUsuario === 'E' ? usuario.sucursalId : dto.idSucursal;
    if (!idSucursal) throw new BadRequestException('No se pudo determinar la sucursal de la venta');

    const id = await this.dataSource.transaction(async (manager) => {
      await this.validarCliente(manager, dto.idCliente);
      const caja = await this.obtenerCajaAbierta(manager, idSucursal);
      await this.validarPasarela(manager, dto.idPasarela);

      const lineas = await this.construirLineas(manager, dto.idAlmacen, dto.items);

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
          idCliente: dto.idCliente,
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

        linea.inventario.stockDisponible -= linea.cantidad;
        await inventarioRepo.save(linea.inventario);
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

  private async validarCliente(manager: EntityManager, idCliente: number): Promise<void> {
    const cliente = await manager.getRepository(Cliente).findOne({ where: { idUsuario: idCliente } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
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

  private async construirLineas(
    manager: EntityManager,
    idAlmacen: number,
    items: CrearVentaDto['items'],
  ): Promise<LineaVenta[]> {
    const varianteRepo = manager.getRepository(VarianteProducto);
    const inventarioRepo = manager.getRepository(Inventario);
    const lineas: LineaVenta[] = [];

    for (const item of items) {
      const variante = await varianteRepo.findOne({
        where: { id: item.idVarianteProducto },
        relations: { producto: true },
      });
      if (!variante) throw new NotFoundException(`Variante ${item.idVarianteProducto} no encontrada`);

      const inventario = await inventarioRepo.findOne({
        where: { idAlmacen, idVarianteProducto: item.idVarianteProducto },
      });
      if (!inventario) throw new BadRequestException('La variante no tiene stock en el almacen seleccionado');
      if (inventario.stockDisponible < item.cantidad) {
        throw new BadRequestException(`Stock insuficiente para la variante ${variante.sku}`);
      }

      const precioUnitario = Number(variante.producto?.precio ?? 0);
      lineas.push({
        idVarianteProducto: variante.id,
        descripcion: `${variante.producto?.nombre ?? 'Producto'} (${variante.talla}/${variante.color})`,
        precioUnitario,
        cantidad: item.cantidad,
        subtotal: redondear(precioUnitario * item.cantidad),
        inventario,
      });
    }

    return lineas;
  }
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

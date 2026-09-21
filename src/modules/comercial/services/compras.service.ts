import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, type Repository } from 'typeorm';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { Proveedor } from '../../inventario/entities/proveedor.entity.js';
import { Almacen } from '../../inventario/entities/almacen.entity.js';
import { VarianteProducto } from '../../inventario/entities/variante-producto.entity.js';
import { ProductoSucursal } from '../../inventario/entities/producto-sucursal.entity.js';
import { Inventario } from '../../inventario/entities/inventario.entity.js';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';
import { EmpleadoSucursal } from '../../operaciones/entities/empleado-sucursal.entity.js';
import { Caja } from '../entities/caja.entity.js';
import { MovimientoCaja } from '../entities/movimiento-caja.entity.js';
import { NotaCompra } from '../entities/nota-compra.entity.js';
import { DetalleNotaCompra } from '../entities/detalle-nota-compra.entity.js';
import { CompraRepository } from '../repositories/compra.repository.js';
import { toCompraResponseDto } from '../mappers/compra.mapper.js';
import type { CrearCompraDto, CrearDetalleCompraDto } from '../dto/crear-compra.dto.js';
import type { ComprasQueryDto } from '../dto/compras-query.dto.js';
import type { CompraResponseDto, ComprasPaginatedResponseDto } from '../dto/compra-response.dto.js';

/** Valores por defecto de INVENTARIO cuando la compra abre el registro de una variante en un almacen. */
const STOCK_MINIMO_INICIAL = 5;
const STOCK_MAXIMO_INICIAL = 500;

function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class ComprasService {
  constructor(
    private readonly compraRepo: CompraRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Proveedor) private readonly proveedorRepo: Repository<Proveedor>,
    @InjectRepository(Sucursal) private readonly sucursalRepo: Repository<Sucursal>,
    @InjectRepository(EmpleadoSucursal) private readonly empleadoSucursalRepo: Repository<EmpleadoSucursal>,
    @InjectRepository(Almacen) private readonly almacenRepo: Repository<Almacen>,
    @InjectRepository(VarianteProducto) private readonly varianteRepo: Repository<VarianteProducto>,
    @InjectRepository(ProductoSucursal) private readonly productoSucursalRepo: Repository<ProductoSucursal>,
  ) {}

  async listar(query: ComprasQueryDto, usuario: ActiveUser): Promise<ComprasPaginatedResponseDto> {
    const idsSucursal = await this.sucursalesVisibles(usuario);
    if (idsSucursal && query.idSucursal !== undefined && !idsSucursal.includes(query.idSucursal)) {
      throw new ForbiddenException('No estas asignado a esa sucursal');
    }

    const { items, total } =
      idsSucursal && idsSucursal.length === 0
        ? { items: [], total: 0 }
        : await this.compraRepo.findPage({ ...query, idsSucursal });

    return {
      items: items.map((compra) => toCompraResponseDto(compra, { incluirDetalles: false })),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async obtener(id: number, usuario: ActiveUser): Promise<CompraResponseDto> {
    const compra = await this.compraRepo.findByIdConDetalle(id);
    if (!compra) throw new NotFoundException('Compra no encontrada');
    await this.validarAccesoSucursal(usuario, compra.idSucursal);
    return toCompraResponseDto(compra);
  }

  async registrar(dto: CrearCompraDto, usuario: ActiveUser): Promise<CompraResponseDto> {
    const proveedor = await this.proveedorRepo.findOne({ where: { id: dto.idProveedor } });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');
    if (!proveedor.activo) throw new ConflictException('El proveedor esta inactivo');

    const sucursal = await this.sucursalRepo.findOne({ where: { id: dto.idSucursal } });
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');
    if (!sucursal.activo) throw new ConflictException('La sucursal esta inactiva');
    await this.validarAccesoSucursal(usuario, dto.idSucursal);

    const nroFactura = dto.nroFactura?.trim() || null;
    if (nroFactura) {
      const repetida = await this.compraRepo.findPorFactura(dto.idProveedor, nroFactura);
      if (repetida) throw new ConflictException('Ya se registro una compra con esa factura para este proveedor');
    }

    await this.validarDetalles(dto.idSucursal, dto.detalles);

    const total = redondear(dto.detalles.reduce((suma, linea) => suma + linea.cantidad * linea.precioUnitario, 0));

    const idCompra = await this.dataSource.transaction(async (manager) => {
      const compra = await manager.getRepository(NotaCompra).save(
        manager.getRepository(NotaCompra).create({
          idProveedor: dto.idProveedor,
          idSucursal: dto.idSucursal,
          idMovimientoCaja: null,
          nroFactura,
          fechaEmision: new Date(),
          fechaEntregaProgramada: dto.fechaEntregaProgramada ?? null,
          fechaPago: null,
          subtotal: total.toFixed(2),
          total: total.toFixed(2),
          estado: 'Recibido',
        }),
      );

      await manager.getRepository(DetalleNotaCompra).save(
        dto.detalles.map((linea) =>
          manager.getRepository(DetalleNotaCompra).create({
            idNotaCompra: compra.id,
            idVarianteProducto: linea.idVarianteProducto,
            idAlmacen: linea.idAlmacen,
            precioUnitario: linea.precioUnitario.toFixed(2),
            cantidad: linea.cantidad,
            subtotal: redondear(linea.cantidad * linea.precioUnitario).toFixed(2),
            nroLote: linea.nroLote?.trim() || null,
          }),
        ),
      );

      await this.incrementarStock(manager.getRepository(Inventario), dto.detalles);

      if (dto.pagarEnCaja) {
        const caja = await manager.getRepository(Caja).findOne({ where: { idSucursal: dto.idSucursal, estado: 'Abierta' } });
        if (!caja) throw new ConflictException('La sucursal no tiene una caja abierta para registrar el egreso');

        const movimiento = await manager.getRepository(MovimientoCaja).save(
          manager.getRepository(MovimientoCaja).create({
            idCaja: caja.id,
            tipo: 'EGRESO',
            concepto: `Compra ${nroFactura ?? `#${compra.id}`} - ${proveedor.empresa}`.slice(0, 150),
            monto: total.toFixed(2),
            observaciones: null,
            fechaHora: new Date(),
          }),
        );
        compra.idMovimientoCaja = movimiento.id;
        compra.fechaPago = new Date().toISOString().slice(0, 10);
        await manager.getRepository(NotaCompra).save(compra);
      }

      return compra.id;
    });

    return this.obtener(idCompra, usuario);
  }

  /**
   * Cada linea debe cumplir el mismo flujo multisucursal que INVENTARIO: el almacen es de la
   * sucursal de la compra y el producto esta activo en esa sucursal.
   */
  private async validarDetalles(idSucursal: number, detalles: CrearDetalleCompraDto[]): Promise<void> {
    const idsAlmacen = [...new Set(detalles.map((linea) => linea.idAlmacen))];
    const almacenes = await this.almacenRepo.find({ where: { id: In(idsAlmacen) } });
    for (const idAlmacen of idsAlmacen) {
      const almacen = almacenes.find((candidato) => candidato.id === idAlmacen);
      if (!almacen) throw new NotFoundException(`Almacen ${idAlmacen} no encontrado`);
      if (!almacen.activo) throw new ConflictException(`El almacen "${almacen.nombre}" esta inactivo`);
      if (almacen.idSucursal !== idSucursal) {
        throw new BadRequestException(`El almacen "${almacen.nombre}" no pertenece a la sucursal de la compra`);
      }
    }

    const idsVariante = [...new Set(detalles.map((linea) => linea.idVarianteProducto))];
    const variantes = await this.varianteRepo.find({ where: { id: In(idsVariante) } });
    for (const idVariante of idsVariante) {
      const variante = variantes.find((candidata) => candidata.id === idVariante);
      if (!variante) throw new NotFoundException(`Variante ${idVariante} no encontrada`);
      if (!variante.activo) throw new ConflictException(`La variante ${variante.sku} esta inactiva`);
    }

    const idsProducto = [...new Set(variantes.map((variante) => variante.idProducto))];
    const activados = await this.productoSucursalRepo.find({
      where: { idSucursal, idProducto: In(idsProducto), activo: true },
    });
    for (const variante of variantes) {
      if (!activados.some((activado) => activado.idProducto === variante.idProducto)) {
        throw new ConflictException(
          `La variante ${variante.sku} pertenece a un producto que no esta activo en esta sucursal; activalo primero en la sucursal`,
        );
      }
    }
  }

  /** Suma la cantidad comprada al stock del almacen; si la variante aun no tenia registro, lo abre. */
  private async incrementarStock(inventarioRepo: Repository<Inventario>, detalles: CrearDetalleCompraDto[]): Promise<void> {
    // Orden fijo para que dos compras concurrentes bloqueen las filas en el mismo orden y no se interbloqueen.
    const lineas = [...detalles].sort((a, b) => a.idAlmacen - b.idAlmacen || a.idVarianteProducto - b.idVarianteProducto);

    for (const linea of lineas) {
      const existente = await inventarioRepo.findOne({
        where: { idAlmacen: linea.idAlmacen, idVarianteProducto: linea.idVarianteProducto },
        lock: { mode: 'pessimistic_write' },
      });

      if (existente) {
        existente.stockDisponible += linea.cantidad;
        await inventarioRepo.save(existente);
      } else {
        await inventarioRepo.save(
          inventarioRepo.create({
            idAlmacen: linea.idAlmacen,
            idVarianteProducto: linea.idVarianteProducto,
            stockDisponible: linea.cantidad,
            stockReservado: 0,
            stockMinimo: STOCK_MINIMO_INICIAL,
            stockMaximo: STOCK_MAXIMO_INICIAL,
          }),
        );
      }
    }
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
      throw new ForbiddenException('No estas asignado a la sucursal de esta compra');
    }
  }
}

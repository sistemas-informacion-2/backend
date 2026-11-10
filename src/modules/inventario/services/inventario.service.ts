import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, type FindOperator, type Repository } from 'typeorm';
import { Almacen } from '../entities/almacen.entity.js';
import { Inventario } from '../entities/inventario.entity.js';
import { MovimientoInventario, type ReferenciaMovimiento } from '../entities/movimiento-inventario.entity.js';
import type { MovimientosQueryDto } from '../dto/movimientos-query.dto.js';
import { VarianteProducto } from '../entities/variante-producto.entity.js';
import { ProductoSucursal } from '../entities/producto-sucursal.entity.js';
import { InventarioRepository } from '../repositories/inventario.repository.js';
import { registrarCostoDeEntrada } from '../utils/costo.util.js';
import { registrarMovimiento } from '../utils/kardex.util.js';
import { toInventarioResponseDto } from '../mappers/inventario.mapper.js';
import type { CrearStockDto } from '../dto/crear-stock.dto.js';
import type { ActualizarStockDto } from '../dto/actualizar-stock.dto.js';
import type { AjustarStockDto } from '../dto/ajustar-stock.dto.js';
import type { InventarioQueryDto } from '../dto/inventario-query.dto.js';
import type { InventarioPaginatedResponseDto, InventarioResponseDto, MovimientoInventarioResponseDto } from '../dto/inventario-response.dto.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';

@Injectable()
export class InventarioService {
  constructor(
    private readonly inventarioRepo: InventarioRepository,
    @InjectRepository(Almacen) private readonly almacenRepo: Repository<Almacen>,
    @InjectRepository(VarianteProducto) private readonly varianteRepo: Repository<VarianteProducto>,
    @InjectRepository(ProductoSucursal) private readonly productoSucursalRepo: Repository<ProductoSucursal>,
    private readonly tenant: TenantContext,
  ) {}

  async listar(query: InventarioQueryDto): Promise<InventarioPaginatedResponseDto> {
    const { items, total } = await this.inventarioRepo.findPage(query);
    return {
      items: items.map(toInventarioResponseDto),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async obtener(id: number): Promise<InventarioResponseDto> {
    const inventario = await this.inventarioRepo.findByIdConDetalle(id);
    if (!inventario) throw new NotFoundException('Registro de inventario no encontrado');
    return toInventarioResponseDto(inventario);
  }

  async registrar(dto: CrearStockDto, usuario: ActiveUser): Promise<InventarioResponseDto> {
    const almacen = await this.almacenRepo.findOne({ where: { id: dto.idAlmacen, idEmpresa: this.tenant.empresaId() } });
    if (!almacen) throw new NotFoundException('Almacen no encontrado');
    if (!almacen.activo) throw new ConflictException('El almacen esta inactivo');

    const variante = await this.varianteRepo.findOne({ where: { id: dto.idVarianteProducto, idEmpresa: this.tenant.empresaId() } });
    if (!variante) throw new NotFoundException('Variante de producto no encontrada');
    if (!variante.activo) throw new ConflictException('La variante esta inactiva');

    // El catalogo es de toda la empresa, pero solo se puede tener stock de lo que la sucursal del almacen tiene activado.
    const activoEnSucursal = await this.productoSucursalRepo.findOne({
      where: { idProducto: variante.idProducto, idSucursal: almacen.idSucursal, activo: true },
    });
    if (!activoEnSucursal) {
      throw new ConflictException(
        'El producto no esta activo en la sucursal de este almacen; activalo primero en esa sucursal',
      );
    }

    const existente = await this.inventarioRepo.findByAlmacenYVariante(dto.idAlmacen, dto.idVarianteProducto);
    if (existente) throw new ConflictException('Esa variante ya esta registrada en el almacen');

    const stockInicial = dto.stockDisponible ?? 0;
    const id = await this.almacenRepo.manager.transaction(async (manager) => {
      // Con costo, el stock inicial entra al promedio como una compra (antes de existir la fila, asi no se cuenta dos veces).
      if (dto.costoUnitario !== undefined && stockInicial > 0) {
        await registrarCostoDeEntrada(manager, variante.id, stockInicial, dto.costoUnitario);
      }

      const repo = manager.getRepository(Inventario);
      const inventario = await repo.save(
        repo.create({
          idAlmacen: dto.idAlmacen,
          idVarianteProducto: dto.idVarianteProducto,
          stockDisponible: stockInicial,
          stockReservado: 0,
          stockMinimo: dto.stockMinimo ?? 5,
          stockMaximo: dto.stockMaximo ?? 500,
        }),
      );
      if (stockInicial > 0) {
        await registrarMovimiento(manager, inventario, {
          tipo: 'SALDO_INICIAL',
          cantidad: stockInicial,
          costoUnitario: dto.costoUnitario ?? null,
          idUsuario: usuario.sub,
          motivo: 'Alta del stock inicial',
        });
      }
      return inventario.id;
    });

    return this.obtener(id);
  }

  async actualizar(id: number, dto: ActualizarStockDto): Promise<InventarioResponseDto> {
    const inventario = await this.inventarioRepo.findByIdConDetalle(id);
    if (!inventario) throw new NotFoundException('Registro de inventario no encontrado');

    const stockMinimo = dto.stockMinimo ?? inventario.stockMinimo;
    const stockMaximo = dto.stockMaximo ?? inventario.stockMaximo;
    if (stockMaximo < stockMinimo) {
      throw new BadRequestException('El stock maximo no puede ser menor que el minimo');
    }

    inventario.stockMinimo = stockMinimo;
    inventario.stockMaximo = stockMaximo;
    await this.inventarioRepo.save(inventario);

    return this.obtener(id);
  }

  /**
   * Ajuste manual (ENTRADA, SALIDA o conteo absoluto AJUSTE). Corre en una transaccion con la fila bloqueada, para no
   * pisar una venta simultanea, y deja en el kardex la diferencia real, el motivo y quien lo hizo.
   */
  async ajustar(id: number, dto: AjustarStockDto, usuario: ActiveUser): Promise<InventarioResponseDto> {
    // Solo un registro de la empresa actual (el repositorio filtra por la empresa del almacen).
    if (!(await this.inventarioRepo.findByIdConDetalle(id))) throw new NotFoundException('Registro de inventario no encontrado');

    await this.almacenRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Inventario);
      const inventario = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!inventario) throw new NotFoundException('Registro de inventario no encontrado');

      const anterior = inventario.stockDisponible;
      if (dto.tipo === 'ENTRADA') {
        inventario.stockDisponible += dto.cantidad;
      } else if (dto.tipo === 'SALIDA') {
        if (dto.cantidad > inventario.stockDisponible) {
          throw new BadRequestException('Stock insuficiente para la salida solicitada');
        }
        inventario.stockDisponible -= dto.cantidad;
      } else {
        inventario.stockDisponible = dto.cantidad;
      }

      const diferencia = inventario.stockDisponible - anterior;
      if (diferencia === 0) return;
      await repo.save(inventario);
      await registrarMovimiento(manager, inventario, {
        tipo: diferencia > 0 ? 'AJUSTE_ENTRADA' : 'AJUSTE_SALIDA',
        cantidad: diferencia,
        referenciaTipo: 'AJUSTE',
        idUsuario: usuario.sub,
        motivo: dto.motivo ?? (dto.tipo === 'AJUSTE' ? 'Conteo de inventario' : null),
      });
    });

    return this.obtener(id);
  }

  /**
   * Historial (kardex) de una fila de stock, del mas reciente al mas antiguo. Sin rango devuelve los ultimos
   * movimientos; con `desde`/`hasta` (fechas de Bolivia, ambas incluidas) todos los del periodo, hasta un tope.
   * Cada movimiento trae el codigo de su documento y el nombre de quien lo hizo, resueltos con una consulta por
   * tipo de documento (no una por fila).
   */
  async movimientos(id: number, query: MovimientosQueryDto = {}): Promise<MovimientoInventarioResponseDto[]> {
    const inventario = await this.inventarioRepo.findByIdConDetalle(id);
    if (!inventario) throw new NotFoundException('Registro de inventario no encontrado');
    if (query.desde && query.hasta && query.desde > query.hasta) {
      throw new BadRequestException('La fecha "desde" no puede ser posterior a "hasta"');
    }

    const idEmpresa = this.tenant.empresaId();
    const conRango = Boolean(query.desde || query.hasta);
    const filas = await this.almacenRepo.manager.getRepository(MovimientoInventario).find({
      where: {
        idAlmacen: inventario.idAlmacen,
        idVarianteProducto: inventario.idVarianteProducto,
        idEmpresa,
        ...(conRango && { fechaHora: rangoDeFechas(query.desde, query.hasta) }),
      },
      order: { fechaHora: 'DESC', id: 'DESC' },
      take: conRango ? MAX_MOVIMIENTOS_CON_RANGO : MAX_MOVIMIENTOS_RECIENTES,
    });

    const [codigos, nombres] = await Promise.all([this.codigosDeDocumentos(filas, idEmpresa), this.nombresDeUsuarios(filas, idEmpresa)]);
    return filas.map((fila) => ({
      id: fila.id,
      tipo: fila.tipo,
      cantidad: fila.cantidad,
      deltaReservado: fila.deltaReservado,
      stockResultante: fila.stockResultante,
      reservadoResultante: fila.reservadoResultante,
      costoUnitario: fila.costoUnitario,
      referenciaTipo: fila.referenciaTipo,
      referenciaId: fila.referenciaId,
      referenciaCodigo: fila.referenciaTipo && fila.referenciaId != null ? (codigos.get(`${fila.referenciaTipo}:${fila.referenciaId}`) ?? null) : null,
      idUsuario: fila.idUsuario,
      usuarioNombre: fila.idUsuario != null ? (nombres.get(fila.idUsuario) ?? null) : null,
      motivo: fila.motivo,
      fechaHora: fila.fechaHora,
    }));
  }

  /** Codigo legible de cada documento, como `TIPO:id` -> codigo. Una consulta por tipo, siempre dentro de la empresa. */
  private async codigosDeDocumentos(filas: MovimientoInventario[], idEmpresa: number): Promise<Map<string, string>> {
    const idsPorTipo = new Map<ReferenciaMovimiento, Set<number>>();
    for (const fila of filas) {
      if (!fila.referenciaTipo || fila.referenciaId == null) continue;
      if (!idsPorTipo.has(fila.referenciaTipo)) idsPorTipo.set(fila.referenciaTipo, new Set());
      idsPorTipo.get(fila.referenciaTipo)!.add(fila.referenciaId);
    }

    const codigos = new Map<string, string>();
    const manager = this.almacenRepo.manager;
    await Promise.all(
      [...idsPorTipo].map(async ([tipo, conjunto]) => {
        const ids = [...conjunto];
        const consulta = CONSULTA_CODIGO[tipo];
        // Sin tabla propia (transferencias) o sin documento (ajustes): el codigo se arma con el id o no hay.
        if (!consulta) {
          if (tipo === 'TRANSFERENCIA') ids.forEach((idDoc) => codigos.set(`${tipo}:${idDoc}`, `TR-${idDoc}`));
          return;
        }
        const resultado: Array<{ id: number; codigo: string }> = await manager.query(consulta, [ids, idEmpresa]);
        for (const { id, codigo } of resultado) codigos.set(`${tipo}:${id}`, codigo);
      }),
    );
    return codigos;
  }

  /** Nombre y apellido de quienes hicieron los movimientos, en una sola consulta dentro de la empresa. */
  private async nombresDeUsuarios(filas: MovimientoInventario[], idEmpresa: number): Promise<Map<number, string>> {
    const ids = [...new Set(filas.map((fila) => fila.idUsuario).filter((idUsuario): idUsuario is number => idUsuario != null))];
    if (ids.length === 0) return new Map();
    const resultado: Array<{ id: number; nombre: string }> = await this.almacenRepo.manager.query(
      `SELECT id, trim(nombre || ' ' || apellido) AS nombre FROM usuario WHERE id = ANY($1) AND id_empresa = $2`,
      [ids, idEmpresa],
    );
    return new Map(resultado.map(({ id, nombre }) => [id, nombre]));
  }
}

/** Sin rango, los ultimos movimientos; con rango, todo el periodo hasta este tope. */
const MAX_MOVIMIENTOS_RECIENTES = 200;
const MAX_MOVIMIENTOS_CON_RANGO = 1000;

/**
 * Como se obtiene el codigo de cada tipo de documento. Devuelven `id` y `codigo`, y filtran por empresa ($2).
 * Las compras no tienen codigo propio: se muestran como NC-<id>, con la factura del proveedor si se cargo.
 */
const CONSULTA_CODIGO: Partial<Record<ReferenciaMovimiento, string>> = {
  NOTA_VENTA: `SELECT id, codigo_nota AS codigo FROM nota_venta WHERE id = ANY($1) AND id_empresa = $2`,
  NOTA_DEVOLUCION: `SELECT id, codigo_devolucion AS codigo FROM nota_devolucion WHERE id = ANY($1) AND id_empresa = $2`,
  RESERVA: `SELECT id, codigo_reserva AS codigo FROM reserva WHERE id = ANY($1) AND id_empresa = $2`,
  NOTA_COMPRA: `SELECT id, 'NC-' || id || coalesce(' · Fact. ' || nullif(trim(nro_factura), ''), '') AS codigo FROM nota_compra WHERE id = ANY($1) AND id_empresa = $2`,
};

/**
 * `fecha_hora` se guarda en hora de Bolivia (la sesion de Postgres y el proceso corren en America/La_Paz), asi
 * que el dia se compara de medianoche a medianoche en esa hora. Ambos extremos son opcionales e incluidos.
 */
function rangoDeFechas(desde?: string, hasta?: string): FindOperator<Date> {
  const inicio = desde ? new Date(`${desde}T00:00:00`) : undefined;
  const fin = hasta ? new Date(`${hasta}T23:59:59.999`) : undefined;
  if (inicio && fin) return Between(inicio, fin);
  return inicio ? MoreThanOrEqual(inicio) : LessThanOrEqual(fin!);
}

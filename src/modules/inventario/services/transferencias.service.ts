import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, type Repository } from 'typeorm';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { Almacen } from '../entities/almacen.entity.js';
import { Inventario } from '../entities/inventario.entity.js';
import { ProductoSucursal } from '../entities/producto-sucursal.entity.js';
import { TransferenciaInventario } from '../entities/transferencia-inventario.entity.js';
import { VarianteProducto } from '../entities/variante-producto.entity.js';
import { registrarMovimiento } from '../utils/kardex.util.js';
import type { TransferenciaResponseDto, TransferirStockDto } from '../dto/transferencia.dto.js';

const STOCK_MINIMO_INICIAL = 5;
const STOCK_MAXIMO_INICIAL = 500;
const LIMITE_LISTADO = 100;

const RELACIONES = {
  almacenOrigen: { sucursal: true },
  almacenDestino: { sucursal: true },
  variante: { producto: true },
} as const;

/** Traslados de stock entre almacenes de la empresa (R6), registrados en el kardex. */
@Injectable()
export class TransferenciasService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Almacen) private readonly almacenRepo: Repository<Almacen>,
    @InjectRepository(VarianteProducto) private readonly varianteRepo: Repository<VarianteProducto>,
    @InjectRepository(ProductoSucursal) private readonly productoSucursalRepo: Repository<ProductoSucursal>,
    @InjectRepository(TransferenciaInventario) private readonly transferenciaRepo: Repository<TransferenciaInventario>,
    private readonly tenant: TenantContext,
  ) {}

  async listar(): Promise<TransferenciaResponseDto[]> {
    const filas = await this.transferenciaRepo.find({
      where: { idEmpresa: this.tenant.empresaId() },
      relations: RELACIONES,
      order: { fechaHora: 'DESC', id: 'DESC' },
      take: LIMITE_LISTADO,
    });
    return filas.map(toTransferenciaResponseDto);
  }

  async obtener(id: number): Promise<TransferenciaResponseDto> {
    const fila = await this.transferenciaRepo.findOne({ where: { id, idEmpresa: this.tenant.empresaId() }, relations: RELACIONES });
    if (!fila) throw new NotFoundException('Transferencia no encontrada');
    return toTransferenciaResponseDto(fila);
  }

  /**
   * Mueve `cantidad` unidades disponibles del almacen de origen al de destino, en una transaccion: bloquea las dos
   * filas de stock (por id de almacen, para que dos transferencias cruzadas no se interbloqueen), abre la del destino
   * si la variante aun no estaba ahi y deja la salida y la entrada en el kardex.
   */
  async transferir(dto: TransferirStockDto, usuario: ActiveUser): Promise<TransferenciaResponseDto> {
    if (dto.idAlmacenOrigen === dto.idAlmacenDestino) throw new BadRequestException('El almacen de origen y el de destino deben ser distintos');
    const idEmpresa = this.tenant.empresaId();

    const almacenes = await this.almacenRepo.find({ where: { id: In([dto.idAlmacenOrigen, dto.idAlmacenDestino]), idEmpresa } });
    const origen = almacenes.find((almacen) => almacen.id === dto.idAlmacenOrigen);
    const destino = almacenes.find((almacen) => almacen.id === dto.idAlmacenDestino);
    if (!origen) throw new NotFoundException('Almacen de origen no encontrado');
    if (!destino) throw new NotFoundException('Almacen de destino no encontrado');
    if (!origen.activo || !destino.activo) throw new ConflictException('Los dos almacenes tienen que estar activos');

    const variante = await this.varianteRepo.findOne({ where: { id: dto.idVarianteProducto, idEmpresa } });
    if (!variante) throw new NotFoundException('Variante de producto no encontrada');
    if (!variante.activo) throw new ConflictException('La variante esta inactiva');

    // Igual que al dar de alta stock: solo se guarda lo que la sucursal del almacen destino tiene activado.
    const activoEnDestino = await this.productoSucursalRepo.findOne({
      where: { idProducto: variante.idProducto, idSucursal: destino.idSucursal, activo: true },
    });
    if (!activoEnDestino) {
      throw new ConflictException('El producto no esta activo en la sucursal del almacen destino; activalo primero en esa sucursal');
    }

    const id = await this.dataSource.transaction(async (manager) => {
      const inventarioRepo = manager.getRepository(Inventario);
      const filas = await inventarioRepo.find({
        where: { idAlmacen: In([origen.id, destino.id]), idVarianteProducto: variante.id },
        order: { idAlmacen: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });

      const filaOrigen = filas.find((fila) => fila.idAlmacen === origen.id);
      const disponible = filaOrigen?.stockDisponible ?? 0;
      if (!filaOrigen || disponible < dto.cantidad) {
        throw new BadRequestException(`Stock insuficiente en el almacen de origen (disponible: ${disponible})`);
      }
      const filaDestino =
        filas.find((fila) => fila.idAlmacen === destino.id) ??
        inventarioRepo.create({
          idAlmacen: destino.id,
          idVarianteProducto: variante.id,
          stockDisponible: 0,
          stockReservado: 0,
          stockMinimo: STOCK_MINIMO_INICIAL,
          stockMaximo: STOCK_MAXIMO_INICIAL,
        });

      filaOrigen.stockDisponible -= dto.cantidad;
      filaDestino.stockDisponible += dto.cantidad;
      await inventarioRepo.save(filaOrigen);
      const destinoGuardado = await inventarioRepo.save(filaDestino);

      const transferenciaRepo = manager.getRepository(TransferenciaInventario);
      const transferencia = await transferenciaRepo.save(
        transferenciaRepo.create({
          idAlmacenOrigen: origen.id,
          idAlmacenDestino: destino.id,
          idVarianteProducto: variante.id,
          cantidad: dto.cantidad,
          motivo: dto.motivo?.trim() || null,
          idUsuario: usuario.sub,
        }),
      );

      const comun = {
        costoUnitario: variante.costoPromedio,
        referenciaTipo: 'TRANSFERENCIA' as const,
        referenciaId: transferencia.id,
        idUsuario: usuario.sub,
        motivo: transferencia.motivo,
      };
      await registrarMovimiento(manager, filaOrigen, { ...comun, tipo: 'TRANSFERENCIA_SALIDA', cantidad: -dto.cantidad });
      await registrarMovimiento(manager, destinoGuardado, { ...comun, tipo: 'TRANSFERENCIA_ENTRADA', cantidad: dto.cantidad });
      return transferencia.id;
    });

    return this.obtener(id);
  }
}

function toTransferenciaResponseDto(fila: TransferenciaInventario): TransferenciaResponseDto {
  return {
    id: fila.id,
    almacenOrigen: { id: fila.idAlmacenOrigen, nombre: fila.almacenOrigen?.nombre ?? '', sucursal: fila.almacenOrigen?.sucursal?.nombre ?? '' },
    almacenDestino: { id: fila.idAlmacenDestino, nombre: fila.almacenDestino?.nombre ?? '', sucursal: fila.almacenDestino?.sucursal?.nombre ?? '' },
    idVarianteProducto: fila.idVarianteProducto,
    sku: fila.variante?.sku ?? '',
    productoNombre: fila.variante?.producto?.nombre ?? '',
    cantidad: fila.cantidad,
    motivo: fila.motivo,
    idUsuario: fila.idUsuario,
    fechaHora: fila.fechaHora,
  };
}

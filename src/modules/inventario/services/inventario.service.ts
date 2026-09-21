import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Almacen } from '../entities/almacen.entity.js';
import { VarianteProducto } from '../entities/variante-producto.entity.js';
import { ProductoSucursal } from '../entities/producto-sucursal.entity.js';
import { InventarioRepository } from '../repositories/inventario.repository.js';
import { toInventarioResponseDto } from '../mappers/inventario.mapper.js';
import type { CrearStockDto } from '../dto/crear-stock.dto.js';
import type { ActualizarStockDto } from '../dto/actualizar-stock.dto.js';
import type { AjustarStockDto } from '../dto/ajustar-stock.dto.js';
import type { InventarioQueryDto } from '../dto/inventario-query.dto.js';
import type { InventarioPaginatedResponseDto, InventarioResponseDto } from '../dto/inventario-response.dto.js';

@Injectable()
export class InventarioService {
  constructor(
    private readonly inventarioRepo: InventarioRepository,
    @InjectRepository(Almacen) private readonly almacenRepo: Repository<Almacen>,
    @InjectRepository(VarianteProducto) private readonly varianteRepo: Repository<VarianteProducto>,
    @InjectRepository(ProductoSucursal) private readonly productoSucursalRepo: Repository<ProductoSucursal>,
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

  async registrar(dto: CrearStockDto): Promise<InventarioResponseDto> {
    const almacen = await this.almacenRepo.findOne({ where: { id: dto.idAlmacen } });
    if (!almacen) throw new NotFoundException('Almacen no encontrado');
    if (!almacen.activo) throw new ConflictException('El almacen esta inactivo');

    const variante = await this.varianteRepo.findOne({ where: { id: dto.idVarianteProducto } });
    if (!variante) throw new NotFoundException('Variante de producto no encontrada');
    if (!variante.activo) throw new ConflictException('La variante esta inactiva');

    // El catalogo es global, pero solo se puede tener stock de lo que la sucursal del almacen tiene activado.
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

    const inventario = this.inventarioRepo.create({
      idAlmacen: dto.idAlmacen,
      idVarianteProducto: dto.idVarianteProducto,
      stockDisponible: dto.stockDisponible ?? 0,
      stockReservado: 0,
      stockMinimo: dto.stockMinimo ?? 5,
      stockMaximo: dto.stockMaximo ?? 500,
    });
    await this.inventarioRepo.save(inventario);

    return this.obtener(inventario.id);
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

  async ajustar(id: number, dto: AjustarStockDto): Promise<InventarioResponseDto> {
    const inventario = await this.inventarioRepo.findByIdConDetalle(id);
    if (!inventario) throw new NotFoundException('Registro de inventario no encontrado');

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

    await this.inventarioRepo.save(inventario);

    return this.obtener(id);
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';
import { AlmacenRepository } from '../repositories/almacen.repository.js';
import { toAlmacenResponseDto } from '../mappers/almacen.mapper.js';
import type { CrearAlmacenDto } from '../dto/crear-almacen.dto.js';
import type { ActualizarAlmacenDto } from '../dto/actualizar-almacen.dto.js';
import type { AlmacenesQueryDto } from '../dto/almacenes-query.dto.js';
import type { AlmacenResponseDto } from '../dto/almacen-response.dto.js';

@Injectable()
export class AlmacenesService {
  constructor(
    private readonly almacenRepo: AlmacenRepository,
    @InjectRepository(Sucursal) private readonly sucursalRepo: Repository<Sucursal>,
  ) {}

  async listar(query: AlmacenesQueryDto): Promise<AlmacenResponseDto[]> {
    const almacenes = await this.almacenRepo.findWithFilters(query);
    return almacenes.map(toAlmacenResponseDto);
  }

  async obtener(id: number): Promise<AlmacenResponseDto> {
    const almacen = await this.almacenRepo.findByIdConDetalle(id);
    if (!almacen) throw new NotFoundException('Almacen no encontrado');
    return toAlmacenResponseDto(almacen);
  }

  async crear(dto: CrearAlmacenDto): Promise<AlmacenResponseDto> {
    await this.validarSucursal(dto.idSucursal);
    await this.validarNombreDisponible(dto.idSucursal, dto.nombre);

    const almacen = this.almacenRepo.create({
      idSucursal: dto.idSucursal,
      nombre: dto.nombre.trim(),
      ubicacionFisica: dto.ubicacionFisica?.trim() || null,
      activo: dto.activo ?? true,
    });
    await this.almacenRepo.save(almacen);

    return this.obtener(almacen.id);
  }

  async actualizar(id: number, dto: ActualizarAlmacenDto): Promise<AlmacenResponseDto> {
    const almacen = await this.almacenRepo.findByIdConDetalle(id);
    if (!almacen) throw new NotFoundException('Almacen no encontrado');

    const idSucursal = dto.idSucursal ?? almacen.idSucursal;
    const nombre = dto.nombre?.trim() ?? almacen.nombre;

    if (dto.idSucursal !== undefined) await this.validarSucursal(dto.idSucursal);
    if (nombre.toLowerCase() !== almacen.nombre.toLowerCase() || idSucursal !== almacen.idSucursal) {
      await this.validarNombreDisponible(idSucursal, nombre, id);
    }

    Object.assign(almacen, {
      idSucursal,
      nombre,
      ...(dto.ubicacionFisica !== undefined && { ubicacionFisica: dto.ubicacionFisica?.trim() || null }),
      ...(dto.activo !== undefined && { activo: dto.activo }),
    });
    await this.almacenRepo.save(almacen);

    return this.obtener(id);
  }

  private async validarSucursal(idSucursal: number): Promise<void> {
    const sucursal = await this.sucursalRepo.findOne({ where: { id: idSucursal } });
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');
  }

  private async validarNombreDisponible(idSucursal: number, nombre: string, excluirId?: number): Promise<void> {
    const existente = await this.almacenRepo.findBySucursalYNombre(idSucursal, nombre);
    if (existente && existente.id !== excluirId) {
      throw new ConflictException('Ya existe un almacen con ese nombre en la sucursal');
    }
  }
}

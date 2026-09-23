import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ProveedorRepository } from '../repositories/proveedor.repository.js';
import { toProveedorResponseDto } from '../mappers/proveedor.mapper.js';
import type { CrearProveedorDto } from '../dto/crear-proveedor.dto.js';
import type { ActualizarProveedorDto } from '../dto/actualizar-proveedor.dto.js';
import type { ProveedoresQueryDto } from '../dto/proveedores-query.dto.js';
import type { ProveedorResponseDto } from '../dto/proveedor-response.dto.js';

@Injectable()
export class ProveedoresService {
  constructor(private readonly proveedorRepo: ProveedorRepository) {}

  async listar(query: ProveedoresQueryDto): Promise<ProveedorResponseDto[]> {
    const proveedores = await this.proveedorRepo.findWithFilters(query);
    return proveedores.map(toProveedorResponseDto);
  }

  async crear(dto: CrearProveedorDto): Promise<ProveedorResponseDto> {
    await this.validarNitDisponible(dto.nit);

    const proveedor = this.proveedorRepo.create({
      empresa: dto.empresa.trim(),
      nit: dto.nit.trim(),
      nombreContacto: dto.nombreContacto?.trim() || null,
      telefonoContacto: dto.telefonoContacto?.trim() || null,
      correoContacto: dto.correoContacto?.trim() || null,
      activo: true,
    });
    await this.proveedorRepo.save(proveedor);

    return toProveedorResponseDto(proveedor);
  }

  async actualizar(id: number, dto: ActualizarProveedorDto): Promise<ProveedorResponseDto> {
    const proveedor = await this.proveedorRepo.findById(id);
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');

    if (dto.nit !== undefined && dto.nit.trim() !== proveedor.nit) {
      await this.validarNitDisponible(dto.nit.trim());
    }

    Object.assign(proveedor, {
      ...(dto.empresa !== undefined && { empresa: dto.empresa.trim() }),
      ...(dto.nit !== undefined && { nit: dto.nit.trim() }),
      ...(dto.nombreContacto !== undefined && { nombreContacto: dto.nombreContacto?.trim() || null }),
      ...(dto.telefonoContacto !== undefined && { telefonoContacto: dto.telefonoContacto?.trim() || null }),
      ...(dto.correoContacto !== undefined && { correoContacto: dto.correoContacto?.trim() || null }),
      ...(dto.activo !== undefined && { activo: dto.activo }),
    });
    await this.proveedorRepo.save(proveedor);

    return toProveedorResponseDto(proveedor);
  }

  private async validarNitDisponible(nit: string): Promise<void> {
    const existente = await this.proveedorRepo.findByNit(nit);
    if (existente) throw new ConflictException('Ya existe un proveedor registrado con ese NIT');
  }
}

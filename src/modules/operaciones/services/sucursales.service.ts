import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SucursalRepository } from '../repositories/sucursal.repository.js';
import { CiudadRepository } from '../repositories/ciudad.repository.js';
import { toSucursalResponseDto } from '../mappers/sucursal.mapper.js';
import type { CrearSucursalDto } from '../dto/crear-sucursal.dto.js';
import type { ActualizarSucursalDto } from '../dto/actualizar-sucursal.dto.js';
import type { SucursalResponseDto } from '../dto/sucursal-response.dto.js';

@Injectable()
export class SucursalesService {
  constructor(
    private readonly sucursalRepo: SucursalRepository,
    private readonly ciudadRepo: CiudadRepository,
  ) {}

  async listar(): Promise<SucursalResponseDto[]> {
    const sucursales = await this.sucursalRepo.findAllConUbicacion();
    return sucursales.map(toSucursalResponseDto);
  }

  async listarActivas(): Promise<SucursalResponseDto[]> {
    const sucursales = await this.sucursalRepo.findAllConUbicacion();
    return sucursales.filter((sucursal) => sucursal.activo).map(toSucursalResponseDto);
  }

  async crear(dto: CrearSucursalDto): Promise<SucursalResponseDto> {
    await this.validarCiudad(dto.idCiudad);

    const sucursal = this.sucursalRepo.create({
      idCiudad: dto.idCiudad,
      nombre: dto.nombre,
      ubicacion: dto.ubicacion,
      telefono: dto.telefono ?? null,
      correo: dto.correo ?? null,
      horarioApertura: dto.horarioApertura ?? null,
      horarioCierre: dto.horarioCierre ?? null,
    });
    await this.sucursalRepo.save(sucursal);

    const creada = await this.sucursalRepo.findByIdConUbicacion(sucursal.id);
    return toSucursalResponseDto(creada!);
  }

  async actualizar(id: number, dto: ActualizarSucursalDto): Promise<SucursalResponseDto> {
    const sucursal = await this.sucursalRepo.findByIdConUbicacion(id);
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');

    if (dto.idCiudad !== undefined) await this.validarCiudad(dto.idCiudad);

    Object.assign(sucursal, {
      ...(dto.idCiudad !== undefined && { idCiudad: dto.idCiudad }),
      ...(dto.nombre !== undefined && { nombre: dto.nombre }),
      ...(dto.ubicacion !== undefined && { ubicacion: dto.ubicacion }),
      ...(dto.telefono !== undefined && { telefono: dto.telefono }),
      ...(dto.correo !== undefined && { correo: dto.correo }),
      ...(dto.horarioApertura !== undefined && { horarioApertura: dto.horarioApertura }),
      ...(dto.horarioCierre !== undefined && { horarioCierre: dto.horarioCierre }),
      ...(dto.activo !== undefined && { activo: dto.activo }),
    });
    await this.sucursalRepo.save(sucursal);

    const actualizada = await this.sucursalRepo.findByIdConUbicacion(id);
    return toSucursalResponseDto(actualizada!);
  }

  private async validarCiudad(idCiudad: number): Promise<void> {
    const ciudad = await this.ciudadRepo.findById(idCiudad);
    if (!ciudad) throw new BadRequestException('La ciudad indicada no existe');
  }
}

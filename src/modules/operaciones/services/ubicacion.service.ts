import { BadRequestException, Injectable } from '@nestjs/common';
import { DepartamentoRepository } from '../repositories/departamento.repository.js';
import { CiudadRepository } from '../repositories/ciudad.repository.js';
import { toCiudadResponseDto, toDepartamentoResponseDto } from '../mappers/sucursal.mapper.js';
import type { CrearCiudadDto } from '../dto/crear-ciudad.dto.js';
import type { CiudadResponseDto, DepartamentoResponseDto } from '../dto/sucursal-response.dto.js';

@Injectable()
export class UbicacionService {
  constructor(
    private readonly departamentoRepo: DepartamentoRepository,
    private readonly ciudadRepo: CiudadRepository,
  ) {}

  async listarDepartamentos(): Promise<DepartamentoResponseDto[]> {
    const departamentos = await this.departamentoRepo.findAll();
    return departamentos.map(toDepartamentoResponseDto);
  }

  async listarCiudades(): Promise<CiudadResponseDto[]> {
    const ciudades = await this.ciudadRepo.findAllConDepartamento();
    return ciudades.map(toCiudadResponseDto);
  }

  async crearCiudad(dto: CrearCiudadDto): Promise<CiudadResponseDto> {
    const departamento = await this.departamentoRepo.findById(dto.idDepartamento);
    if (!departamento) throw new BadRequestException('El departamento indicado no existe');

    const ciudad = this.ciudadRepo.create({
      idDepartamento: dto.idDepartamento,
      nombre: dto.nombre,
      ubicacion: dto.ubicacion ?? null,
    });
    await this.ciudadRepo.save(ciudad);

    const creada = await this.ciudadRepo.findByIdConDepartamento(ciudad.id);
    return toCiudadResponseDto(creada!);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { EmpresaResolver } from '../../../common/tenant/empresa-resolver.service.js';
import { Empresa } from '../entities/empresa.entity.js';
import { toEmpresaPublica, toEmpresaResponse } from '../mappers/empresa.mapper.js';
import type {
  ActualizarEmpresaDto,
  CambiarEstadoEmpresaDto,
  CrearEmpresaDto,
  EmpresaPublicaResponseDto,
  EmpresaResponseDto,
} from '../dto/empresa.dto.js';
import { AprovisionamientoService } from './aprovisionamiento.service.js';

/** Gestion de empresas desde el panel de la plataforma (solo superadmin). */
@Injectable()
export class EmpresasService {
  constructor(
    @InjectRepository(Empresa) private readonly empresaRepo: Repository<Empresa>,
    private readonly aprovisionamiento: AprovisionamientoService,
    private readonly resolver: EmpresaResolver,
  ) {}

  async listar(): Promise<EmpresaResponseDto[]> {
    const empresas = await this.empresaRepo.find({ order: { id: 'ASC' } });
    return empresas.map(toEmpresaResponse);
  }

  async obtener(id: number): Promise<EmpresaResponseDto> {
    return toEmpresaResponse(await this.buscar(id));
  }

  async crear(dto: CrearEmpresaDto): Promise<EmpresaResponseDto> {
    return toEmpresaResponse(await this.aprovisionamiento.crearEmpresa(dto));
  }

  /** El slug no se cambia: es la URL de la tienda y lo usan los clientes, la app movil y los enlaces ya compartidos. */
  async actualizar(id: number, dto: ActualizarEmpresaDto): Promise<EmpresaResponseDto> {
    const empresa = await this.buscar(id);
    Object.assign(empresa, {
      ...(dto.nombre !== undefined && { nombre: dto.nombre.trim() }),
      ...(dto.razonSocial !== undefined && { razonSocial: dto.razonSocial.trim() || null }),
      ...(dto.nit !== undefined && { nit: dto.nit.trim() || null }),
      ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl.trim() || null }),
      ...(dto.colorPrimario !== undefined && { colorPrimario: dto.colorPrimario }),
    });
    await this.empresaRepo.save(empresa);
    this.resolver.invalidar();
    return toEmpresaResponse(empresa);
  }

  /**
   * Suspender no borra nada: la tienda, su login y los tokens ya emitidos responden 403 (TenantGuard revisa el
   * estado en cada request) hasta que se reactive.
   */
  async cambiarEstado(id: number, dto: CambiarEstadoEmpresaDto): Promise<EmpresaResponseDto> {
    const empresa = await this.buscar(id);
    empresa.estado = dto.estado;
    await this.empresaRepo.save(empresa);
    this.resolver.invalidar();
    return toEmpresaResponse(empresa);
  }

  async publica(slug: string): Promise<EmpresaPublicaResponseDto> {
    const empresa = await this.empresaRepo.findOne({ where: { slug: slug.trim().toLowerCase() } });
    if (!empresa) throw new NotFoundException('Tienda no encontrada');
    return toEmpresaPublica(empresa);
  }

  private async buscar(id: number): Promise<Empresa> {
    const empresa = await this.empresaRepo.findOne({ where: { id } });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    return empresa;
  }
}

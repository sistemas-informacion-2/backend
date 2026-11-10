import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { EmpresaResolver } from '../../../common/tenant/empresa-resolver.service.js';
import { sumarDias } from '../../../common/tenant/plan-vigencia.js';
import { ahora } from '../../../common/utils/reloj.js';
import { Empresa } from '../entities/empresa.entity.js';
import { toEmpresaPublica, toEmpresaResponse } from '../mappers/empresa.mapper.js';
import type {
  ActualizarEmpresaDto,
  CambiarEstadoEmpresaDto,
  CambiarPlanEmpresaDto,
  CrearEmpresaDto,
  EmpresaPublicaResponseDto,
  EmpresaResponseDto,
} from '../dto/empresa.dto.js';
import { AprovisionamientoService } from './aprovisionamiento.service.js';
import { PlanesService } from './planes.service.js';

/** Gestion de empresas desde el panel de la plataforma (solo superadmin). */
@Injectable()
export class EmpresasService {
  constructor(
    @InjectRepository(Empresa) private readonly empresaRepo: Repository<Empresa>,
    private readonly aprovisionamiento: AprovisionamientoService,
    private readonly planes: PlanesService,
    private readonly resolver: EmpresaResolver,
  ) {}

  async listar(): Promise<EmpresaResponseDto[]> {
    const empresas = await this.empresaRepo.find({ relations: { plan: true }, order: { id: 'ASC' } });
    return empresas.map(toEmpresaResponse);
  }

  async obtener(id: number): Promise<EmpresaResponseDto> {
    return toEmpresaResponse(await this.buscar(id));
  }

  /** Alta manual: por defecto con la prueba gratuita; `sinVencimiento` la deja sin fecha (cortesia). */
  async crear(dto: CrearEmpresaDto): Promise<EmpresaResponseDto> {
    const plan = await this.planes.porCodigo(dto.codigoPlan ?? 'PRUEBA');
    const empresa = await this.aprovisionamiento.crearEmpresa({
      slug: dto.slug,
      nombre: dto.nombre,
      razonSocial: dto.razonSocial,
      nit: dto.nit,
      ciudad: dto.ciudad,
      codigoPlan: plan.codigo,
      planVenceEl: dto.sinVencimiento ? null : sumarDias(ahora(), plan.duracionDias),
      admin: dto.admin,
    });
    return toEmpresaResponse(empresa);
  }

  /** El slug no se cambia: es la URL de la tienda y lo usan los clientes, la app movil y los enlaces ya compartidos. */
  async actualizar(id: number, dto: ActualizarEmpresaDto): Promise<EmpresaResponseDto> {
    const empresa = await this.buscar(id);
    Object.assign(empresa, {
      ...(dto.nombre !== undefined && { nombre: dto.nombre.trim() }),
      ...(dto.razonSocial !== undefined && { razonSocial: dto.razonSocial.trim() || null }),
      ...(dto.nit !== undefined && { nit: dto.nit.trim() || null }),
      ...(dto.ciudad !== undefined && { ciudad: dto.ciudad.trim() || null }),
      ...(dto.direccion !== undefined && { direccion: dto.direccion.trim() || null }),
      ...(dto.telefono !== undefined && { telefono: dto.telefono.trim() || null }),
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

  /** Cambia el plan y fija el vencimiento a mano (cortesia, pago fuera de Stripe). Bajar de plan no borra nada. */
  async cambiarPlan(id: number, dto: CambiarPlanEmpresaDto): Promise<EmpresaResponseDto> {
    const empresa = await this.buscar(id);
    const plan = await this.planes.porCodigo(dto.codigoPlan);
    empresa.idPlan = plan.id;
    empresa.plan = plan;
    empresa.planVenceEl = dto.venceEl === null ? null : finDelDia(dto.venceEl);
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
    const empresa = await this.empresaRepo.findOne({ where: { id }, relations: { plan: true } });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    return empresa;
  }
}

/** Una fecha sola (AAAA-MM-DD) vale hasta el final de ese dia en hora de Bolivia; una fecha con hora, tal cual. */
function finDelDia(valor: string): Date {
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (soloFecha) return new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]), 23, 59, 59);
  return new Date(valor);
}

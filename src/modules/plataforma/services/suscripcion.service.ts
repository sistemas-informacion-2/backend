import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import type { AppConfig } from '../../../config/configuration.js';
import { EmpresaResolver } from '../../../common/tenant/empresa-resolver.service.js';
import { LimitesPlanService } from '../../../common/tenant/limites-plan.service.js';
import { estadoVigencia, finDeGracia, inicioDeNuevoPeriodo, sumarDias } from '../../../common/tenant/plan-vigencia.js';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';
import { ahora } from '../../../common/utils/reloj.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { Empresa } from '../entities/empresa.entity.js';
import { PagoPlan } from '../entities/pago-plan.entity.js';
import { toPagoPlanResponse, toPlanResponse } from '../mappers/plan.mapper.js';
import type { PagarPlanDto } from '../dto/plan.dto.js';
import type { IniciarPagoResponseDto, MiPlanResponseDto, PagoConfirmadoResponseDto } from '../dto/suscripcion.dto.js';
import { CobroPlanService } from './cobro-plan.service.js';
import { PlanesService } from './planes.service.js';

const DIA_MS = 86_400_000;

/**
 * Mi plan, dentro de la tienda: ver el plan, su vigencia y su uso, y pagar otro periodo (renovacion) o pasar a otro
 * plan. Responde aunque el plan haya vencido (la ruta es @PermitidoSinPlan): es justo cuando hace falta.
 */
@Injectable()
export class SuscripcionService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tenant: TenantContext,
    private readonly resolver: EmpresaResolver,
    private readonly limites: LimitesPlanService,
    private readonly planes: PlanesService,
    private readonly cobro: CobroPlanService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async miPlan(usuario: ActiveUser): Promise<MiPlanResponseDto> {
    const empresa = await this.empresaActual();
    const [uso, pagos] = await Promise.all([
      this.limites.uso(),
      this.dataSource.getRepository(PagoPlan).find({
        // Un pago abierto en Stripe y nunca completado queda PENDIENTE para siempre: no es historial.
        where: { idEmpresa: empresa.id, estado: In(['PAGADO', 'FALLIDO']) },
        relations: { plan: true },
        order: { fechaCreacion: 'DESC', id: 'DESC' },
        take: 10,
      }),
    ]);
    const venceEl = empresa.planVenceEl;
    return {
      plan: toPlanResponse(empresa.plan),
      venceEl,
      vigencia: estadoVigencia(venceEl),
      finDeGracia: venceEl ? finDeGracia(venceEl) : null,
      diasRestantes: venceEl ? Math.ceil((new Date(venceEl).getTime() - ahora().getTime()) / DIA_MS) : null,
      uso,
      puedeGestionar: usuario.tipoUsuario === 'A',
      pagos: pagos.map(toPagoPlanResponse),
    };
  }

  /** Abre el pago de un periodo del plan elegido: el mismo (renovacion) u otro (cambio de plan). Solo el administrador. */
  async iniciarPago(dto: PagarPlanDto, usuario: ActiveUser): Promise<IniciarPagoResponseDto> {
    if (usuario.tipoUsuario !== 'A') throw new ForbiddenException('Solo el administrador de la tienda puede pagar el plan');
    const empresa = await this.empresaActual();
    const plan = await this.planes.contratable(dto.codigoPlan);
    if (plan.esPrueba) throw new BadRequestException('La prueba gratuita no se puede contratar de nuevo; elige un plan de pago');

    const repo = this.dataSource.getRepository(PagoPlan);
    const pago = await repo.save(
      repo.create({
        idEmpresa: empresa.id,
        idPlan: plan.id,
        tipo: plan.id === empresa.idPlan ? 'RENOVACION' : 'CAMBIO_PLAN',
        estado: 'PENDIENTE',
        monto: plan.precio,
        idUsuario: usuario.sub,
      }),
    );

    const panel = `${this.config.get('frontendUrl', { infer: true })}/t/${empresa.slug}/admin/plan`;
    const sesion = await this.cobro.abrirSesion(pago, {
      descripcion: `DOMINATR · Plan ${plan.nombre} (${plan.duracionDias} días) · ${empresa.nombre}`,
      urlRetorno: `${panel}/retorno`,
      urlCancelado: `${panel}?pago=cancelado`,
    });
    return { urlPago: sesion.url, montoBob: plan.precio, montoCobrado: sesion.montoCobrado, monedaCobro: sesion.monedaCobro };
  }

  /**
   * Vuelta de Stripe. Una renovacion se suma al final del periodo vigente (no se pierden dias pagados); un cambio
   * de plan empieza hoy. Idempotente: recargar la pagina no cobra ni extiende dos veces.
   */
  async confirmarPago(sessionId: string): Promise<PagoConfirmadoResponseDto> {
    const idEmpresa = this.tenant.empresaId();
    await this.cobro.confirmar(
      sessionId,
      (pago) => pago.idEmpresa === idEmpresa && pago.tipo !== 'ALTA',
      async (manager, pago) => {
        const repo = manager.getRepository(Empresa);
        const empresa = await repo.findOne({ where: { id: idEmpresa }, lock: { mode: 'pessimistic_write' } });
        if (!empresa) throw new NotFoundException('Empresa no encontrada');

        const desde = pago.tipo === 'RENOVACION' ? inicioDeNuevoPeriodo(empresa.planVenceEl) : ahora();
        const hasta = sumarDias(desde, pago.plan.duracionDias);
        empresa.idPlan = pago.idPlan;
        empresa.planVenceEl = hasta;
        await repo.save(empresa);
        pago.periodoDesde = desde;
        pago.periodoHasta = hasta;
      },
    );
    // El plan nuevo (limites, funciones, vencimiento) rige desde el proximo request.
    this.resolver.invalidar();

    const empresa = await this.empresaActual();
    return { codigoPlan: empresa.plan.codigo, planNombre: empresa.plan.nombre, venceEl: empresa.planVenceEl };
  }

  private async empresaActual(): Promise<Empresa> {
    const empresa = await this.dataSource.getRepository(Empresa).findOne({ where: { id: this.tenant.empresaId() }, relations: { plan: true } });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    return empresa;
  }
}

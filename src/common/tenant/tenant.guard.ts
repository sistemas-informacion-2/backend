import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AppConfig } from '../../config/configuration.js';
import type { ActiveUser } from '../../modules/acceso/types/jwt-payload.type.js';
import type { FuncionPlan } from '../../modules/plataforma/entities/plan.entity.js';
import { NOMBRE_FUNCION, PERMITIDO_SIN_PLAN, REQUIERE_PLAN } from '../decorators/plan.decorator.js';
import { ES_RUTA_PLATAFORMA } from '../decorators/solo-plataforma.decorator.js';
import { EmpresaResolver } from './empresa-resolver.service.js';
import { estadoVigencia } from './plan-vigencia.js';
import { TenantContext, type EmpresaActual } from './tenant-context.service.js';

export const HEADER_EMPRESA = 'x-empresa';

/** Codigos en el campo `error` de la respuesta: el frontend los usa para llevar a Mi plan. */
export const ERROR_PLAN_VENCIDO = 'PLAN_VENCIDO';
export const ERROR_PLAN_SIN_FUNCION = 'PLAN_SIN_FUNCION';
/** La app movil los usa para mostrar "Tienda no disponible" sin confundirlos con otros 403/404. */
export const ERROR_EMPRESA_SUSPENDIDA = 'EMPRESA_SUSPENDIDA';
export const ERROR_EMPRESA_NO_EXISTE = 'EMPRESA_NO_EXISTE';

/**
 * Decide la empresa de cada request y la deja en TenantContext. Corre despues
 * de JwtAuthGuard (orden de registro en CommonModule), asi que en rutas
 * protegidas ya tiene el token validado:
 *
 * 1. Token con empresa: manda el token. Si ademas viene X-Empresa y no
 *    coincide, se rechaza (un token de una tienda no sirve en otra).
 * 2. Sin token con empresa (rutas publicas, tokens previos al SaaS): el slug
 *    del header X-Empresa o, si no viene, el slug por defecto de la config.
 * 3. Sin nada de lo anterior la ruta queda sin empresa; quien llame a
 *    TenantContext.empresaId() ahi recibe un error.
 *
 * Ademas hace cumplir el plan de la empresa:
 * - Plan vencido (pasada la gracia): 402 PLAN_VENCIDO, salvo en las rutas @PermitidoSinPlan (login, Mi plan).
 * - @RequierePlan('bi' | 'reportesAvanzados'): 403 PLAN_SIN_FUNCION si el plan no la incluye.
 *
 * Las rutas @SoloPlataforma no corren dentro de ninguna empresa y, autenticadas,
 * son solo del superadmin. A la inversa, el superadmin no entra a las rutas de
 * una tienda: el dueno de la plataforma no ve los datos de sus clientes.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly slugPorDefecto: string;

  constructor(
    private readonly resolver: EmpresaResolver,
    private readonly tenant: TenantContext,
    config: ConfigService<AppConfig, true>,
    private readonly reflector: Reflector,
  ) {
    this.slugPorDefecto = config.get('tenant.slugPorDefecto', { infer: true });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<Request & { user?: ActiveUser }>();
    const esRutaPlataforma = this.metadato<boolean>(ES_RUTA_PLATAFORMA, context);
    const esSuperadmin = request.user?.tipoUsuario === 'S';

    if (esRutaPlataforma) {
      if (request.user && !esSuperadmin) throw new ForbiddenException('Solo el superadmin de la plataforma puede usar esta ruta');
      return true;
    }
    if (esSuperadmin) throw new ForbiddenException('El superadmin de la plataforma no opera dentro de una tienda');

    const slugHeader = normalizarSlug(request.headers[HEADER_EMPRESA]);
    const empresaToken = request.user?.empresaId;

    if (empresaToken != null) {
      const empresa = await this.resolver.porId(empresaToken);
      if (!empresa) throw new UnauthorizedException('La empresa de la sesion ya no existe');
      if (slugHeader && slugHeader !== empresa.slug) {
        throw new ForbiddenException('La sesion pertenece a otra empresa');
      }
      return this.usar(empresa, context);
    }

    const slug = slugHeader || this.slugPorDefecto;
    if (!slug) return true;

    const empresa = await this.resolver.porSlug(slug);
    if (!empresa) throw new NotFoundException({ message: `La empresa "${slug}" no existe`, error: ERROR_EMPRESA_NO_EXISTE });
    return this.usar(empresa, context);
  }

  private usar(empresa: EmpresaActual, context: ExecutionContext): boolean {
    if (empresa.estado !== 'ACTIVA') throw new ForbiddenException({ message: 'La empresa esta suspendida', error: ERROR_EMPRESA_SUSPENDIDA });

    if (estadoVigencia(empresa.planVenceEl) === 'VENCIDO' && !this.metadato<boolean>(PERMITIDO_SIN_PLAN, context)) {
      throw new HttpException(
        { message: 'El plan de esta tienda venció. Renuévalo desde Mi plan para seguir operando.', error: ERROR_PLAN_VENCIDO },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const funcion = this.metadato<FuncionPlan | undefined>(REQUIERE_PLAN, context);
    if (funcion && !empresa.plan[funcion]) {
      throw new ForbiddenException({
        message: `Tu plan ${empresa.plan.nombre} no incluye ${NOMBRE_FUNCION[funcion]}. Puedes cambiar de plan desde Mi plan.`,
        error: ERROR_PLAN_SIN_FUNCION,
      });
    }

    this.tenant.establecer(empresa);
    return true;
  }

  private metadato<T>(clave: string, context: ExecutionContext): T {
    return this.reflector.getAllAndOverride<T>(clave, [context.getHandler(), context.getClass()]);
  }
}

function normalizarSlug(valor: string | string[] | undefined): string {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return (texto ?? '').trim().toLowerCase();
}

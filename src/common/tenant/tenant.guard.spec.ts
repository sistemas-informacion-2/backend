import { ForbiddenException, HttpException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PERMITIDO_SIN_PLAN, REQUIERE_PLAN } from '../decorators/plan.decorator.js';
import { ES_RUTA_PLATAFORMA } from '../decorators/solo-plataforma.decorator.js';
import { TenantGuard } from './tenant.guard.js';
import type { EmpresaActual, PlanActual } from './tenant-context.service.js';

const DIA_MS = 86_400_000;
const empresarial: PlanActual = { codigo: 'EMPRESARIAL', nombre: 'Empresarial', maxUsuarios: 200, maxSucursales: 10, maxAlmacenes: 20, reportesAvanzados: true, bi: true };
const emprendedor: PlanActual = { codigo: 'EMPRENDEDOR', nombre: 'Emprendedor', maxUsuarios: 20, maxSucursales: 1, maxAlmacenes: 1, reportesAvanzados: false, bi: false };

function empresa(id: number, slug: string, extra: Partial<EmpresaActual> = {}): EmpresaActual {
  return { id, slug, nombre: slug, estado: 'ACTIVA', plan: empresarial, planVenceEl: null, ...extra };
}

const fashion = empresa(1, 'fashionstore');
const otra = empresa(2, 'otra');
const suspendida = empresa(3, 'suspendida', { estado: 'SUSPENDIDA' });
const vencida = empresa(4, 'vencida', { planVenceEl: new Date(Date.now() - 5 * DIA_MS) });
const enGracia = empresa(5, 'en-gracia', { planVenceEl: new Date(Date.now() - 1 * DIA_MS) });
const basica = empresa(6, 'basica', { plan: emprendedor, planVenceEl: new Date(Date.now() + 20 * DIA_MS) });
const empresas = [fashion, otra, suspendida, vencida, enGracia, basica];

function crearGuard(slugPorDefecto = 'fashionstore', metadatos: Record<string, unknown> = {}) {
  const resolver = {
    porSlug: vi.fn(async (slug: string) => empresas.find((e) => e.slug === slug) ?? null),
    porId: vi.fn(async (id: number) => empresas.find((e) => e.id === id) ?? null),
  };
  const tenant = { establecer: vi.fn() };
  const config = { get: vi.fn().mockReturnValue(slugPorDefecto) };
  const reflector = { getAllAndOverride: vi.fn((clave: string) => metadatos[clave]) };
  const guard = new TenantGuard(resolver as never, tenant as never, config as never, reflector as never);
  return { guard, tenant };
}

function contexto(headers: Record<string, string> = {}, user?: { empresaId?: number | null; tipoUsuario?: string }) {
  return {
    getType: () => 'http',
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ headers, user }) }),
  } as never;
}

async function errorDe(promesa: Promise<unknown>): Promise<HttpException> {
  try {
    await promesa;
  } catch (error) {
    return error as HttpException;
  }
  throw new Error('Se esperaba un error');
}

describe('TenantGuard', () => {
  it('usa la empresa del header X-Empresa en rutas publicas', async () => {
    const { guard, tenant } = crearGuard();

    await expect(guard.canActivate(contexto({ 'x-empresa': ' OTRA ' }))).resolves.toBe(true);

    expect(tenant.establecer).toHaveBeenCalledWith(otra);
  });

  it('sin header ni token usa la empresa por defecto', async () => {
    const { guard, tenant } = crearGuard();

    await guard.canActivate(contexto());

    expect(tenant.establecer).toHaveBeenCalledWith(fashion);
  });

  it('sin header ni empresa por defecto deja la ruta sin empresa', async () => {
    const { guard, tenant } = crearGuard('');

    await expect(guard.canActivate(contexto())).resolves.toBe(true);

    expect(tenant.establecer).not.toHaveBeenCalled();
  });

  it('el token manda sobre el slug por defecto', async () => {
    const { guard, tenant } = crearGuard();

    await guard.canActivate(contexto({}, { empresaId: 2 }));

    expect(tenant.establecer).toHaveBeenCalledWith(otra);
  });

  it('rechaza un token usado con el header de otra empresa', async () => {
    const { guard } = crearGuard();

    await expect(guard.canActivate(contexto({ 'x-empresa': 'fashionstore' }, { empresaId: 2 }))).rejects.toThrow(ForbiddenException);
  });

  it('rechaza un token cuya empresa ya no existe', async () => {
    const { guard } = crearGuard();

    await expect(guard.canActivate(contexto({}, { empresaId: 99 }))).rejects.toThrow(UnauthorizedException);
  });

  it('responde 404 EMPRESA_NO_EXISTE con un slug que no existe', async () => {
    const { guard } = crearGuard();

    const error = await errorDe(guard.canActivate(contexto({ 'x-empresa': 'nadie' })));

    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.getResponse()).toMatchObject({ message: 'La empresa "nadie" no existe', error: 'EMPRESA_NO_EXISTE' });
  });

  it('las rutas de plataforma no usan empresa y son solo del superadmin', async () => {
    const { guard, tenant } = crearGuard('fashionstore', { [ES_RUTA_PLATAFORMA]: true });

    await expect(guard.canActivate(contexto())).resolves.toBe(true);
    await expect(guard.canActivate(contexto({}, { empresaId: null, tipoUsuario: 'S' }))).resolves.toBe(true);
    await expect(guard.canActivate(contexto({}, { empresaId: 1, tipoUsuario: 'A' }))).rejects.toThrow(ForbiddenException);
    expect(tenant.establecer).not.toHaveBeenCalled();
  });

  it('el superadmin no entra a las rutas de una tienda', async () => {
    const { guard } = crearGuard();

    await expect(guard.canActivate(contexto({ 'x-empresa': 'fashionstore' }, { empresaId: null, tipoUsuario: 'S' }))).rejects.toThrow(ForbiddenException);
  });

  it('bloquea una empresa suspendida con 403 EMPRESA_SUSPENDIDA, venga por header o por token', async () => {
    const { guard } = crearGuard();

    for (const ctx of [contexto({ 'x-empresa': 'suspendida' }), contexto({}, { empresaId: 3 })]) {
      const error = await errorDe(guard.canActivate(ctx));
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.getResponse()).toMatchObject({ message: 'La empresa esta suspendida', error: 'EMPRESA_SUSPENDIDA' });
    }
  });

  it('los demas 403 no llevan el codigo de empresa suspendida', async () => {
    const { guard } = crearGuard();

    const error = await errorDe(guard.canActivate(contexto({ 'x-empresa': 'fashionstore' }, { empresaId: 2 })));

    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.getResponse()).not.toMatchObject({ error: 'EMPRESA_SUSPENDIDA' });
  });

  describe('plan', () => {
    it('con el plan vencido (pasada la gracia) responde 402 PLAN_VENCIDO', async () => {
      const { guard, tenant } = crearGuard();

      const error = await errorDe(guard.canActivate(contexto({}, { empresaId: 4, tipoUsuario: 'A' })));

      expect(error.getStatus()).toBe(402);
      expect(error.getResponse()).toMatchObject({ error: 'PLAN_VENCIDO' });
      expect(tenant.establecer).not.toHaveBeenCalled();
    });

    it('con el plan vencido deja pasar las rutas @PermitidoSinPlan (login, Mi plan)', async () => {
      const { guard, tenant } = crearGuard('fashionstore', { [PERMITIDO_SIN_PLAN]: true });

      await expect(guard.canActivate(contexto({ 'x-empresa': 'vencida' }))).resolves.toBe(true);
      expect(tenant.establecer).toHaveBeenCalledWith(vencida);
    });

    it('en los dias de gracia la tienda sigue operando', async () => {
      const { guard } = crearGuard();

      await expect(guard.canActivate(contexto({}, { empresaId: 5, tipoUsuario: 'A' }))).resolves.toBe(true);
    });

    it('una ruta @RequierePlan responde 403 PLAN_SIN_FUNCION si el plan no la incluye', async () => {
      const { guard } = crearGuard('fashionstore', { [REQUIERE_PLAN]: 'bi' });

      const error = await errorDe(guard.canActivate(contexto({}, { empresaId: 6, tipoUsuario: 'A' })));

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.getResponse()).toMatchObject({ error: 'PLAN_SIN_FUNCION' });
      await expect(guard.canActivate(contexto({}, { empresaId: 1, tipoUsuario: 'A' }))).resolves.toBe(true);
    });
  });
});

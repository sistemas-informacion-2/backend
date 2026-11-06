import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { TenantGuard } from './tenant.guard.js';
import type { EmpresaActual } from './tenant-context.service.js';

const fashion: EmpresaActual = { id: 1, slug: 'fashionstore', nombre: 'FashionStore', estado: 'ACTIVA' };
const otra: EmpresaActual = { id: 2, slug: 'otra', nombre: 'Otra', estado: 'ACTIVA' };
const suspendida: EmpresaActual = { id: 3, slug: 'suspendida', nombre: 'Suspendida', estado: 'SUSPENDIDA' };
const empresas = [fashion, otra, suspendida];

function crearGuard(slugPorDefecto = 'fashionstore') {
  const resolver = {
    porSlug: vi.fn(async (slug: string) => empresas.find((empresa) => empresa.slug === slug) ?? null),
    porId: vi.fn(async (id: number) => empresas.find((empresa) => empresa.id === id) ?? null),
  };
  const tenant = { establecer: vi.fn() };
  const config = { get: vi.fn().mockReturnValue(slugPorDefecto) };
  const guard = new TenantGuard(resolver as never, tenant as never, config as never);
  return { guard, tenant };
}

function contexto(headers: Record<string, string> = {}, user?: { empresaId?: number | null }) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ headers, user }) }),
  } as never;
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

  it('responde 404 con un slug que no existe', async () => {
    const { guard } = crearGuard();

    await expect(guard.canActivate(contexto({ 'x-empresa': 'nadie' }))).rejects.toThrow(NotFoundException);
  });

  it('bloquea una empresa suspendida, venga por header o por token', async () => {
    const { guard } = crearGuard();

    await expect(guard.canActivate(contexto({ 'x-empresa': 'suspendida' }))).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(contexto({}, { empresaId: 3 }))).rejects.toThrow(ForbiddenException);
  });
});

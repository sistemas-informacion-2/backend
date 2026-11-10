import { ConflictException } from '@nestjs/common';
import { RegistroService } from './registro.service.js';
import type { RegistroEmpresaDto } from '../dto/registro.dto.js';

const prueba = { id: 1, codigo: 'PRUEBA', nombre: 'Prueba gratuita', precio: 0, duracionDias: 7, esPrueba: true };
const emprendedor = { id: 2, codigo: 'EMPRENDEDOR', nombre: 'Emprendedor', precio: 149, duracionDias: 30, esPrueba: false };

function dto(codigoPlan: 'PRUEBA' | 'EMPRENDEDOR'): RegistroEmpresaDto {
  return {
    codigoPlan,
    empresa: { razonSocial: 'Moda Andina SRL', nombreComercial: 'Moda Andina', nit: '3049182019', pais: 'Bolivia', ciudad: 'Santa Cruz', slug: 'moda-andina' },
    admin: { nombre: 'Carla', apellido: 'Mendoza', email: 'carla@modaandina.bo', password: 'Secreta123' },
  };
}

function crear(opciones: { pruebaUsada?: boolean } = {}) {
  const pagos: Array<Record<string, unknown>> = [];
  const pagoRepo = {
    create: vi.fn((datos: Record<string, unknown>) => datos),
    save: vi.fn(async (datos: Record<string, unknown>) => {
      const fila = { id: pagos.length + 1, ...datos };
      pagos.push(fila);
      return fila;
    }),
  };
  const empresaRepo = { findOne: vi.fn(async () => ({ id: 10, slug: 'moda-andina', nombre: 'Moda Andina', planVenceEl: new Date() })) };
  const manager = { getRepository: vi.fn((entidad: { name: string }) => (entidad.name === 'PagoPlan' ? pagoRepo : empresaRepo)) };
  const dataSource = {
    ...manager,
    transaction: vi.fn(async (callback: (m: unknown) => unknown) => callback(manager)),
    query: vi.fn(async () => (opciones.pruebaUsada ? [{ '?column?': 1 }] : [])),
  };
  const aprovisionamiento = {
    validarDisponible: vi.fn(),
    crearEmpresa: vi.fn(async () => ({ id: 10, slug: 'moda-andina', nombre: 'Moda Andina' })),
  };
  const planes = { contratable: vi.fn(async (codigo: string) => (codigo === 'PRUEBA' ? prueba : emprendedor)) };
  const cobro = { abrirSesion: vi.fn(async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_1', montoCobrado: 21.41, monedaCobro: 'USD' })) };
  const config = { get: vi.fn(() => 'http://localhost:5173') };
  const service = new RegistroService(dataSource as never, aprovisionamiento as never, planes as never, cobro as never, config as never);
  return { service, pagos, aprovisionamiento, cobro };
}

describe('RegistroService.registrar', () => {
  it('con la prueba gratuita crea la tienda al instante, sin pasar por Stripe', async () => {
    const { service, aprovisionamiento, cobro, pagos } = crear();

    const respuesta = await service.registrar(dto('PRUEBA'), '1.1.1.1');

    expect(respuesta.urlPago).toBeNull();
    expect(respuesta.tienda).toMatchObject({ slug: 'moda-andina', codigoPlan: 'PRUEBA', adminEmail: 'carla@modaandina.bo' });
    expect(cobro.abrirSesion).not.toHaveBeenCalled();
    expect(aprovisionamiento.crearEmpresa).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Moda Andina', razonSocial: 'Moda Andina SRL', codigoPlan: 'PRUEBA', admin: expect.objectContaining({ password: 'Secreta123' }) }),
      expect.anything(),
    );
    // La prueba queda en el historial como un pago de Bs 0, sin la contrasena.
    expect(pagos[0]).toMatchObject({ tipo: 'ALTA', estado: 'PAGADO', monto: 0 });
    expect(JSON.stringify(pagos[0])).not.toContain('Secreta123');
  });

  it('no da una segunda prueba gratuita con el mismo NIT o correo', async () => {
    const { service, aprovisionamiento } = crear({ pruebaUsada: true });

    await expect(service.registrar(dto('PRUEBA'), '1.1.1.2')).rejects.toThrow(ConflictException);
    expect(aprovisionamiento.crearEmpresa).not.toHaveBeenCalled();
  });

  it('con un plan de pago guarda la solicitud (contrasena cifrada) y devuelve el enlace de Stripe', async () => {
    const { service, aprovisionamiento, cobro, pagos } = crear();

    const respuesta = await service.registrar(dto('EMPRENDEDOR'), '1.1.1.3');

    expect(respuesta).toEqual({ urlPago: 'https://checkout.stripe.com/c/pay/cs_1', tienda: null });
    expect(aprovisionamiento.crearEmpresa).not.toHaveBeenCalled();
    expect(pagos[0]).toMatchObject({ tipo: 'ALTA', estado: 'PENDIENTE', monto: 149, idEmpresa: null });
    const guardado = JSON.stringify(pagos[0]);
    expect(guardado).not.toContain('Secreta123');
    expect(guardado).toMatch(/"passwordHash":"\$2[aby]\$/);
    expect(cobro.abrirSesion).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ urlRetorno: 'http://localhost:5173/registro/retorno' }),
    );
  });
});

describe('RegistroService.slugDisponible', () => {
  it('rechaza formatos invalidos y direcciones reservadas', async () => {
    const { service } = crear();

    await expect(service.slugDisponible('Moda Andina')).resolves.toMatchObject({ disponible: false });
    await expect(service.slugDisponible('admin')).resolves.toMatchObject({ disponible: false, motivo: 'Esa dirección está reservada.' });
  });
});

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { VentasEnLineaService } from './ventas-en-linea.service.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';

const admin: ActiveUser = { sub: 1, tipoUsuario: 'A', permisos: [], jti: 'x' };
const empleado: ActiveUser = { sub: 5, tipoUsuario: 'E', permisos: [], jti: 'x', sucursalId: 1 };

function ventaOnline(overrides: Record<string, unknown> = {}) {
  return {
    id: 8,
    codigoNota: 'NV-000008',
    idCliente: 7,
    cliente: { usuario: { nombre: 'Ana', apellido: 'Perez' } },
    idSucursal: 1,
    sucursal: { nombre: 'Central' },
    pasarela: { metodo: 'PayPal' },
    tipoVenta: 'E_COMMERCE',
    subtotal: 100,
    descuento: 0,
    impuesto: 0,
    montoTotal: 100,
    detalles: [],
    pagos: [],
    ...overrides,
  };
}

function crearService(venta: Record<string, unknown> | null = ventaOnline(), visibles: number[] = [1]) {
  const notaVentaRepo = {
    findPage: vi.fn().mockResolvedValue({ items: [ventaOnline()], total: 1 }),
    findByIdConDetalle: vi.fn().mockResolvedValue(venta),
  };
  const empleadoSucursalRepo = { find: vi.fn().mockResolvedValue(visibles.map((idSucursal) => ({ idSucursal }))) };
  return { service: new VentasEnLineaService(notaVentaRepo as never, empleadoSucursalRepo as never), notaVentaRepo };
}

describe('VentasEnLineaService', () => {
  it('lista solo notas E_COMMERCE, con el metodo de pago', async () => {
    const { service, notaVentaRepo } = crearService();

    const respuesta = await service.listar({ page: 1, limit: 10 }, admin);

    expect(notaVentaRepo.findPage).toHaveBeenCalledWith(expect.objectContaining({ tipoVenta: 'E_COMMERCE', idsSucursal: undefined }));
    expect(respuesta.items[0]).toMatchObject({ codigoNota: 'NV-000008', pasarelaMetodo: 'PayPal', clienteNombre: 'Ana Perez' });
    expect(respuesta.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
  });

  it('un empleado ve solo las ventas de sus sucursales', async () => {
    const { service, notaVentaRepo } = crearService(ventaOnline(), [1, 3]);

    await service.listar({ page: 1, limit: 10 }, empleado);

    expect(notaVentaRepo.findPage).toHaveBeenCalledWith(expect.objectContaining({ idsSucursal: [1, 3] }));
  });

  it('un empleado sin sucursales asignadas ve una lista vacia', async () => {
    const { service, notaVentaRepo } = crearService(ventaOnline(), []);

    const respuesta = await service.listar({ page: 1, limit: 10 }, empleado);

    expect(respuesta.items).toEqual([]);
    expect(notaVentaRepo.findPage).not.toHaveBeenCalled();
  });

  it('un empleado no filtra por una sucursal ajena', async () => {
    const { service } = crearService();

    await expect(service.listar({ page: 1, limit: 10, idSucursal: 9 }, empleado)).rejects.toThrow(ForbiddenException);
  });

  it('abre el detalle de una venta en linea', async () => {
    const { service } = crearService();

    await expect(service.obtener(8, admin)).resolves.toMatchObject({ id: 8, tipoVenta: 'E_COMMERCE' });
  });

  it('una venta presencial o inexistente no se abre por esta pantalla', async () => {
    await expect(crearService(ventaOnline({ tipoVenta: 'DIRECTA_PRESENCIAL' })).service.obtener(8, admin)).rejects.toThrow(NotFoundException);
    await expect(crearService(null).service.obtener(8, admin)).rejects.toThrow(NotFoundException);
  });

  it('un empleado no abre ventas de otra sucursal', async () => {
    const { service } = crearService(ventaOnline({ idSucursal: 4 }));

    await expect(service.obtener(8, empleado)).rejects.toThrow(ForbiddenException);
  });
});

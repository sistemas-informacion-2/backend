import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { VentasService } from './ventas.service.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';

const cliente: ActiveUser = { sub: 7, tipoUsuario: 'C', permisos: [], jti: 'x' };
const empleado: ActiveUser = { sub: 5, tipoUsuario: 'E', permisos: [], jti: 'x', sucursalId: 1 };

function crearService(venta: Record<string, unknown> | null = { id: 3, idCliente: 7, detalles: [], pagos: [] }) {
  const notaVentaRepo = {
    findPage: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findByIdConDetalle: vi.fn().mockResolvedValue(venta),
  };
  const service = new VentasService({} as never, notaVentaRepo as never, {} as never, {} as never);
  return { service, notaVentaRepo };
}

describe('VentasService: compras propias del cliente', () => {
  it('lista solo las compras del cliente del token', async () => {
    const { service, notaVentaRepo } = crearService();

    await service.listarPropias({ page: 1, limit: 10 }, cliente);

    expect(notaVentaRepo.findPage).toHaveBeenCalledWith({ page: 1, limit: 10, idCliente: 7 });
  });

  it('el personal no usa las rutas del cliente', async () => {
    const { service } = crearService();

    await expect(service.listarPropias({ page: 1, limit: 10 }, empleado)).rejects.toThrow(ForbiddenException);
    await expect(service.obtenerPropia(3, empleado)).rejects.toThrow(ForbiddenException);
  });

  it('una compra ajena es indistinguible de una inexistente', async () => {
    const ajena = crearService({ id: 3, idCliente: 99, detalles: [], pagos: [] });
    const inexistente = crearService(null);

    await expect(ajena.service.obtenerPropia(3, cliente)).rejects.toThrow(NotFoundException);
    await expect(inexistente.service.obtenerPropia(3, cliente)).rejects.toThrow(NotFoundException);
  });

  it('devuelve la compra propia', async () => {
    const { service } = crearService();

    await expect(service.obtenerPropia(3, cliente)).resolves.toMatchObject({ id: 3, idCliente: 7 });
  });
});

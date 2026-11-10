import { ConflictException, ForbiddenException } from '@nestjs/common';
import { NotaVenta } from '../../comercial/entities/nota-venta.entity.js';
import { Almacen } from '../../inventario/entities/almacen.entity.js';
import { Inventario } from '../../inventario/entities/inventario.entity.js';
import { ProductoSucursal } from '../../inventario/entities/producto-sucursal.entity.js';
import { VarianteProducto } from '../../inventario/entities/variante-producto.entity.js';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { Carrito } from '../entities/carrito.entity.js';
import { DetalleCarrito } from '../entities/detalle-carrito.entity.js';
import { Reserva } from '../entities/reserva.entity.js';
import { ComprasOfflineService } from './compras-offline.service.js';

const cliente: ActiveUser = { sub: 7, tipoUsuario: 'C', permisos: [], jti: 'x' };
const compra = { idLocal: 'compra_off_169823412', idSucursal: 1, detalles: [{ idVariante: 3, cantidad: 2, precioUnitario: 100 }], fechaCreacion: '2026-11-08T10:00:00.000Z' };

function preparar(opciones: { stock?: number; nota?: Partial<NotaVenta> | null; precio?: number } = {}) {
  const carritoGuardado = vi.fn(async (carrito: Record<string, unknown>) => ({ ...carrito, id: 4 }));
  const detalles = { delete: vi.fn(), save: vi.fn(), create: vi.fn((d: unknown) => d) };
  const reservas = { save: vi.fn(), create: vi.fn() };
  const inventarios = { find: vi.fn().mockResolvedValue([{ stockDisponible: opciones.stock ?? 5 }]) };
  const repos = new Map<unknown, unknown>([
    [NotaVenta, { findOne: vi.fn().mockResolvedValue(opciones.nota ?? null) }],
    [Sucursal, { findOne: vi.fn().mockResolvedValue({ id: 1, activo: true }) }],
    [VarianteProducto, { find: vi.fn().mockResolvedValue([{ id: 3, idProducto: 9, sku: 'SKU-3', activo: true, producto: { nombre: 'Polera', activo: true, precio: opciones.precio ?? 100, descuentoPorcentaje: 0 } }]) }],
    [ProductoSucursal, { find: vi.fn().mockResolvedValue([{ idProducto: 9 }]) }],
    [Almacen, { find: vi.fn().mockResolvedValue([{ id: 1 }]) }],
    [Inventario, inventarios],
    [Carrito, { findOne: vi.fn().mockResolvedValue({ id: 4, idCliente: 7 }), save: carritoGuardado, create: vi.fn((c: unknown) => c) }],
    [DetalleCarrito, detalles],
    [Reserva, reservas],
  ]);
  const manager = { getRepository: (entidad: unknown) => repos.get(entidad) };
  const dataSource = { getRepository: (entidad: unknown) => repos.get(entidad), transaction: vi.fn(async (fn: (m: typeof manager) => unknown) => fn(manager)) };
  return { service: new ComprasOfflineService(dataSource as never, { empresaId: () => 2 } as never), detalles, reservas, inventarios, carritoGuardado, dataSource, repos };
}

describe('ComprasOfflineService (RF-SYNC-01)', () => {
  it('con stock deja la compra en el carrito, lista para pagar el total, y no crea una reserva', async () => {
    const { service, detalles, reservas, carritoGuardado, inventarios } = preparar();
    const respuesta = await service.sincronizar(compra, cliente);

    expect(respuesta).toMatchObject({ estadoSincronizacion: 'PENDIENTE_PAGO', montoTotal: 200, preciosActualizados: false });
    expect(reservas.save).not.toHaveBeenCalled();
    expect(carritoGuardado).toHaveBeenCalledWith(expect.objectContaining({ idSucursal: 1, idLocalOffline: compra.idLocal }));
    expect(detalles.delete).toHaveBeenCalledWith({ idCarrito: 4 });
    expect(detalles.save).toHaveBeenCalledWith([expect.objectContaining({ idVarianteProducto: 3, cantidad: 2, subtotal: '200.00' })]);
    expect(inventarios.find).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
  });

  it('sin stock responde 409 COMPRA_RECHAZADA_STOCK_AGOTADO y no toca el carrito', async () => {
    const { service, detalles } = preparar({ stock: 1 });
    const error = await service.sincronizar(compra, cliente).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      codigo_error: 'COMPRA_RECHAZADA_STOCK_AGOTADO',
      items_afectados: [{ id_variante: 3, stock_solicitado: 2, stock_actual: 1 }],
    });
    expect(detalles.save).not.toHaveBeenCalled();
  });

  it('un reenvio de una compra ya pagada no vuelve a llenar el carrito', async () => {
    const { service, dataSource } = preparar({ nota: { codigoNota: 'NV-000010', montoTotal: 200 } });
    await expect(service.sincronizar(compra, cliente)).resolves.toMatchObject({ estadoSincronizacion: 'COMPLETADA', codigoNota: 'NV-000010' });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('avisa si el precio cambio mientras estaba sin conexion', async () => {
    const { service } = preparar({ precio: 120 });
    await expect(service.sincronizar(compra, cliente)).resolves.toMatchObject({ montoTotal: 240, preciosActualizados: true });
  });

  it('solo busca la sucursal, las variantes, los almacenes y la nota dentro de la empresa del request', async () => {
    const { service, repos } = preparar();
    await service.sincronizar(compra, cliente);

    const consulta = (entidad: unknown, metodo: 'find' | 'findOne') => (repos.get(entidad) as Record<string, ReturnType<typeof vi.fn>>)[metodo].mock.calls[0][0];
    expect(consulta(Sucursal, 'findOne').where).toMatchObject({ id: 1, idEmpresa: 2 });
    expect(consulta(VarianteProducto, 'find').where).toMatchObject({ idEmpresa: 2 });
    expect(consulta(Almacen, 'find').where).toMatchObject({ idSucursal: 1, idEmpresa: 2 });
    expect(consulta(NotaVenta, 'findOne').where).toMatchObject({ idLocalOffline: compra.idLocal, idCliente: 7, idEmpresa: 2 });
  });

  it('solo un cliente puede sincronizar', async () => {
    const { service } = preparar();
    await expect(service.sincronizar(compra, { ...cliente, tipoUsuario: 'A' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('informa el estado despues de pagar', async () => {
    await expect(preparar({ nota: { codigoNota: 'NV-000011', montoTotal: 50 } }).service.estado(compra.idLocal, cliente)).resolves.toMatchObject({ estadoSincronizacion: 'COMPLETADA', codigoNota: 'NV-000011' });
    await expect(preparar().service.estado(compra.idLocal, cliente)).resolves.toMatchObject({ estadoSincronizacion: 'PENDIENTE_PAGO' });
  });
});

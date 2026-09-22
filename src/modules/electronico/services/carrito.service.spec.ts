import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CarritoService } from './carrito.service.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';

const cliente: ActiveUser = { sub: 9, tipoUsuario: 'C', permisos: [], jti: 'x' };

function varianteBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    idProducto: 5,
    sku: 'SKU-7',
    talla: 'M',
    color: 'Negra',
    corte: 'Oversize',
    activo: true,
    producto: { id: 5, nombre: 'Polera', precio: 100, descuentoPorcentaje: 20, activo: true, imagenes: [] },
    ...overrides,
  };
}

function carritoBase(detalles: unknown[] = [], idSucursal: number | null = 2) {
  return { id: 3, idCliente: 9, idSucursal, fechaActualizacion: new Date('2026-09-21T10:00:00Z'), detalles };
}

const SUCURSAL = { id: 2, nombre: 'Sucursal Centro', activo: true };

function crearService(
  overrides: {
    variante?: unknown;
    stock?: number;
    carrito?: unknown;
    existente?: unknown;
    sucursal?: unknown;
  } = {},
) {
  const carrito = 'carrito' in overrides ? overrides.carrito : carritoBase();
  const carritoRepo = {
    findByCliente: vi.fn().mockResolvedValue(carrito),
    obtenerOCrear: vi.fn().mockResolvedValue({ id: 3, idCliente: 9, idSucursal: 2 }),
    fijarSucursal: vi.fn().mockResolvedValue(undefined),
    findDetalle: vi.fn().mockResolvedValue(overrides.existente ?? null),
    findDetallePorVariante: vi.fn().mockResolvedValue(overrides.existente ?? null),
    createDetalle: vi.fn((datos) => ({ ...datos })),
    saveDetalle: vi.fn((datos) => Promise.resolve(datos)),
    removeDetalle: vi.fn().mockResolvedValue(undefined),
    vaciar: vi.fn().mockResolvedValue(undefined),
    tocar: vi.fn().mockResolvedValue(undefined),
  };
  const stock = overrides.stock ?? 10;
  const disponibilidad = {
    stockPorVariante: vi.fn(async (ids: number[]) => new Map(ids.map((id) => [id, stock]))),
  };
  const varianteRepo = {
    findOne: vi.fn().mockResolvedValue('variante' in overrides ? overrides.variante : varianteBase()),
  };
  const sucursalRepo = {
    findOne: vi.fn().mockResolvedValue('sucursal' in overrides ? overrides.sucursal : SUCURSAL),
  };

  return {
    service: new CarritoService(carritoRepo as never, disponibilidad as never, varianteRepo as never, sucursalRepo as never),
    carritoRepo,
    disponibilidad,
    sucursalRepo,
  };
}

describe('CarritoService', () => {
  it('solo los clientes tienen carrito', async () => {
    const { service } = crearService();

    await expect(service.obtener({ ...cliente, tipoUsuario: 'A' })).rejects.toThrow(ForbiddenException);
    await expect(
      service.agregarItem({ ...cliente, tipoUsuario: 'E' }, { idVarianteProducto: 7, idSucursal: 2, cantidad: 1 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('un cliente sin carrito ve uno vacio y no se crea nada', async () => {
    const { service, carritoRepo } = crearService({ carrito: null });

    const respuesta = await service.obtener(cliente);

    expect(respuesta).toEqual({ id: null, idSucursal: null, items: [], cantidadTotal: 0, total: 0, fechaActualizacion: null });
    expect(carritoRepo.obtenerOCrear).not.toHaveBeenCalled();
  });

  it('rechaza una sucursal inexistente o inactiva', async () => {
    const { service } = crearService({ sucursal: null });
    await expect(service.agregarItem(cliente, { idVarianteProducto: 7, idSucursal: 99, cantidad: 1 })).rejects.toThrow(BadRequestException);

    const inactiva = crearService({ sucursal: { ...SUCURSAL, activo: false } });
    await expect(inactiva.service.agregarItem(cliente, { idVarianteProducto: 7, idSucursal: 2, cantidad: 1 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('agrega una variante nueva con el precio con descuento y el subtotal', async () => {
    const { service, carritoRepo } = crearService();

    await service.agregarItem(cliente, { idVarianteProducto: 7, idSucursal: 2, cantidad: 3, notasEspeciales: ' regalo ' });

    // 100 con 20% de descuento = 80.00; 3 x 80 = 240.00
    expect(carritoRepo.saveDetalle).toHaveBeenCalledWith(
      expect.objectContaining({ idCarrito: 3, idVarianteProducto: 7, cantidad: 3, precioUnitario: '80.00', subtotal: '240.00', notasEspeciales: 'regalo' }),
    );
    expect(carritoRepo.tocar).toHaveBeenCalledWith(3);
  });

  it('si la variante ya estaba en el carrito suma la cantidad', async () => {
    const existente = { id: 11, idCarrito: 3, idVarianteProducto: 7, cantidad: 2, precioUnitario: '80.00', subtotal: '160.00', notasEspeciales: null };
    const { service, carritoRepo } = crearService({ existente });

    await service.agregarItem(cliente, { idVarianteProducto: 7, idSucursal: 2, cantidad: 2 });

    expect(carritoRepo.createDetalle).not.toHaveBeenCalled();
    expect(carritoRepo.saveDetalle).toHaveBeenCalledWith(expect.objectContaining({ id: 11, cantidad: 4, subtotal: '320.00' }));
  });

  it('rechaza superar el stock contando lo que ya hay en el carrito', async () => {
    const existente = { id: 11, idCarrito: 3, idVarianteProducto: 7, cantidad: 2 };
    const { service, carritoRepo } = crearService({ existente, stock: 3 });

    await expect(service.agregarItem(cliente, { idVarianteProducto: 7, idSucursal: 2, cantidad: 2 })).rejects.toThrow(ConflictException);
    expect(carritoRepo.saveDetalle).not.toHaveBeenCalled();
  });

  it('rechaza una variante agotada, inactiva o de un producto inactivo', async () => {
    const agotada = crearService({ stock: 0 });
    await expect(agotada.service.agregarItem(cliente, { idVarianteProducto: 7, idSucursal: 2, cantidad: 1 })).rejects.toThrow(ConflictException);

    const inactiva = crearService({ variante: varianteBase({ activo: false }) });
    await expect(inactiva.service.agregarItem(cliente, { idVarianteProducto: 7, idSucursal: 2, cantidad: 1 })).rejects.toThrow(NotFoundException);

    const productoInactivo = crearService({ variante: varianteBase({ producto: { ...varianteBase().producto, activo: false } }) });
    await expect(productoInactivo.service.agregarItem(cliente, { idVarianteProducto: 7, idSucursal: 2, cantidad: 1 })).rejects.toThrow(NotFoundException);
  });

  it('rechaza pasar del maximo por variante aunque haya stock', async () => {
    const existente = { id: 11, idCarrito: 3, idVarianteProducto: 7, cantidad: 99 };
    const { service } = crearService({ existente, stock: 500 });

    await expect(service.agregarItem(cliente, { idVarianteProducto: 7, idSucursal: 2, cantidad: 2 })).rejects.toThrow(BadRequestException);
  });

  it('fija la cantidad de un item validando el stock', async () => {
    const detalle = { id: 11, idCarrito: 3, idVarianteProducto: 7, cantidad: 1, precioUnitario: '80.00', subtotal: '80.00' };
    const { service, carritoRepo } = crearService({ existente: detalle, stock: 5 });

    await service.actualizarCantidad(cliente, 11, { cantidad: 5 });
    expect(carritoRepo.saveDetalle).toHaveBeenCalledWith(expect.objectContaining({ cantidad: 5, subtotal: '400.00' }));

    await expect(service.actualizarCantidad(cliente, 11, { cantidad: 6 })).rejects.toThrow(ConflictException);
  });

  it('no permite tocar un item que no es del carrito del cliente', async () => {
    const { service, carritoRepo } = crearService({ existente: null });

    await expect(service.actualizarCantidad(cliente, 99, { cantidad: 1 })).rejects.toThrow(NotFoundException);
    await expect(service.quitarItem(cliente, 99)).rejects.toThrow(NotFoundException);
    expect(carritoRepo.findDetalle).toHaveBeenCalledWith(3, 99);
    expect(carritoRepo.removeDetalle).not.toHaveBeenCalled();
  });

  it('quita un item y vacia el carrito, actualizando la fecha', async () => {
    const detalle = { id: 11, idCarrito: 3, idVarianteProducto: 7, cantidad: 1 };
    const { service, carritoRepo } = crearService({ existente: detalle });

    await service.quitarItem(cliente, 11);
    expect(carritoRepo.removeDetalle).toHaveBeenCalledWith(detalle);

    await service.vaciar(cliente);
    expect(carritoRepo.vaciar).toHaveBeenCalledWith(3);
    expect(carritoRepo.tocar).toHaveBeenCalledTimes(2);
  });

  it('marca como no disponible el item cuyo stock ya no alcanza', async () => {
    const detalle = { id: 11, idCarrito: 3, idVarianteProducto: 7, cantidad: 4, precioUnitario: '80.00', notasEspeciales: null, variante: varianteBase() };
    const { service } = crearService({ carrito: carritoBase([detalle]), stock: 2 });

    const respuesta = await service.obtener(cliente);

    expect(respuesta.items[0]).toMatchObject({ cantidad: 4, stockDisponible: 2, disponible: false, precioUnitario: 80, subtotal: 320 });
    expect(respuesta.total).toBe(320);
    expect(respuesta.cantidadTotal).toBe(4);
  });
});

import { ConflictException, NotFoundException } from '@nestjs/common';
import { CajaService } from './caja.service.js';
import type { Caja } from '../entities/caja.entity.js';
import type { MovimientoCaja } from '../entities/movimiento-caja.entity.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';

function cajaBase(overrides: Partial<Caja> = {}): Caja {
  return {
    id: 1,
    idSucursal: 1,
    sucursal: { nombre: 'Central' } as never,
    idCajero: 5,
    cajero: null,
    fechaApertura: new Date('2026-09-21T08:00:00Z'),
    fechaCierre: null,
    horaApertura: '08:00:00',
    horaCierre: null,
    montoInicial: '100.00',
    montoFinal: null,
    estado: 'Abierta',
    movimientos: [],
    ...overrides,
  };
}

function movimientoBase(overrides: Partial<MovimientoCaja> = {}): MovimientoCaja {
  return {
    id: 1,
    idCaja: 1,
    caja: undefined as never,
    tipo: 'INGRESO',
    concepto: 'Venta',
    monto: '30.00',
    observaciones: null,
    fechaHora: new Date('2026-09-21T09:00:00Z'),
    ...overrides,
  };
}

function empleado(sub = 5): ActiveUser {
  return { sub, tipoUsuario: 'E', permisos: [], jti: 'x' };
}

function crearService(overrides: {
  cajaRepo?: Record<string, ReturnType<typeof vi.fn>>;
  movimientoRepo?: Record<string, ReturnType<typeof vi.fn>>;
  sucursalRepo?: Record<string, ReturnType<typeof vi.fn>>;
} = {}) {
  const cajaRepo = {
    findWithFilters: vi.fn(),
    findByIdConDetalle: vi.fn(),
    findAbiertaPorSucursal: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    ...overrides.cajaRepo,
  };
  const movimientoRepo = {
    findByCaja: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    ...overrides.movimientoRepo,
  };
  const sucursalRepo = {
    findOne: vi.fn().mockResolvedValue({ id: 1 }),
    ...overrides.sucursalRepo,
  };

  return {
    service: new CajaService(cajaRepo as never, movimientoRepo as never, sucursalRepo as never),
    cajaRepo,
    movimientoRepo,
    sucursalRepo,
  };
}

describe('CajaService', () => {
  it('abre una caja atando al cajero autenticado', async () => {
    const caja = cajaBase({ idCajero: 5 });
    const { service, cajaRepo } = crearService({
      cajaRepo: {
        findAbiertaPorSucursal: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockReturnValue(caja),
        save: vi.fn().mockResolvedValue(caja),
        findByIdConDetalle: vi.fn().mockResolvedValue(caja),
      },
    });

    const response = await service.abrir({ idSucursal: 1, montoInicial: 100 }, empleado(5));

    expect(cajaRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ idSucursal: 1, idCajero: 5, montoInicial: '100.00', estado: 'Abierta' }),
    );
    expect(response.montoInicial).toBe(100);
    expect(response.estado).toBe('Abierta');
  });

  it('abre la caja sin cajero cuando el usuario no tiene legajo (administrador)', async () => {
    const caja = cajaBase({ idCajero: null });
    const { service, cajaRepo } = crearService({
      cajaRepo: {
        findAbiertaPorSucursal: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockReturnValue(caja),
        save: vi.fn().mockResolvedValue(caja),
        findByIdConDetalle: vi.fn().mockResolvedValue(caja),
      },
    });

    await service.abrir({ idSucursal: 1, montoInicial: 0 }, { ...empleado(99), tipoUsuario: 'A' });

    expect(cajaRepo.create).toHaveBeenCalledWith(expect.objectContaining({ idCajero: null }));
  });

  it('rechaza abrir si la sucursal ya tiene una caja abierta', async () => {
    const { service, cajaRepo } = crearService({
      cajaRepo: { findAbiertaPorSucursal: vi.fn().mockResolvedValue(cajaBase()) },
    });

    await expect(service.abrir({ idSucursal: 1, montoInicial: 50 }, empleado())).rejects.toThrow(
      ConflictException,
    );
    expect(cajaRepo.save).not.toHaveBeenCalled();
  });

  it('rechaza abrir en una sucursal inexistente', async () => {
    const { service, cajaRepo } = crearService({
      sucursalRepo: { findOne: vi.fn().mockResolvedValue(null) },
    });

    await expect(service.abrir({ idSucursal: 99, montoInicial: 50 }, empleado())).rejects.toThrow(
      NotFoundException,
    );
    expect(cajaRepo.save).not.toHaveBeenCalled();
  });

  it('rechaza registrar movimientos en una caja cerrada', async () => {
    const { service, movimientoRepo } = crearService({
      cajaRepo: { findByIdConDetalle: vi.fn().mockResolvedValue(cajaBase({ estado: 'Cerrada' })) },
    });

    await expect(
      service.registrarMovimiento(1, { tipo: 'INGRESO', concepto: 'Venta', monto: 10 }),
    ).rejects.toThrow(ConflictException);
    expect(movimientoRepo.save).not.toHaveBeenCalled();
  });

  it('cierra la caja con el monto esperado si no se informa el final', async () => {
    const caja = cajaBase({
      montoInicial: '100.00',
      movimientos: [
        movimientoBase({ id: 1, tipo: 'INGRESO', monto: '30.00' }),
        movimientoBase({ id: 2, tipo: 'EGRESO', monto: '10.00' }),
      ],
    });
    const { service, cajaRepo } = crearService({
      cajaRepo: {
        findByIdConDetalle: vi.fn().mockResolvedValue(caja),
        save: vi.fn().mockResolvedValue(caja),
      },
    });

    await service.cerrar(1, {});

    expect(caja.montoFinal).toBe('120.00');
    expect(caja.estado).toBe('Cerrada');
    expect(cajaRepo.save).toHaveBeenCalled();
  });

  it('expone totales y monto esperado al listar', async () => {
    const caja = cajaBase({
      montoInicial: '100.00',
      movimientos: [
        movimientoBase({ id: 1, tipo: 'INGRESO', monto: '50.00' }),
        movimientoBase({ id: 2, tipo: 'EGRESO', monto: '20.50' }),
      ],
    });
    const { service } = crearService({
      cajaRepo: { findWithFilters: vi.fn().mockResolvedValue([caja]) },
    });

    const [response] = await service.listar({});

    expect(response.totalIngresos).toBe(50);
    expect(response.totalEgresos).toBe(20.5);
    expect(response.montoEsperado).toBe(129.5);
  });
});

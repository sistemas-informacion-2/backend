import { costoPromedioPonderado, registrarCostoDeEntrada } from './costo.util.js';
import { Inventario } from '../entities/inventario.entity.js';
import { VarianteProducto } from '../entities/variante-producto.entity.js';

describe('costoPromedioPonderado', () => {
  it('la primera entrada fija el costo', () => {
    expect(costoPromedioPonderado(0, null, 10, 25)).toBe(25);
  });

  it('pondera por unidades: 10 a 20 + 30 a 40 = 35', () => {
    expect(costoPromedioPonderado(10, 20, 30, 40)).toBe(35);
  });

  it('sin costo previo conocido usa el de la entrada aunque haya stock', () => {
    expect(costoPromedioPonderado(8, null, 2, 12.5)).toBe(12.5);
  });

  it('redondea a 4 decimales', () => {
    expect(costoPromedioPonderado(3, 10, 1, 11)).toBe(10.25);
    expect(costoPromedioPonderado(2, 10, 1, 11)).toBe(10.3333);
  });
});

describe('registrarCostoDeEntrada', () => {
  function crearManager(variante: { id: number; costoPromedio: number | null } | null, existencias: Array<{ stockDisponible: number; stockReservado: number }>) {
    const varianteRepo = { findOne: vi.fn().mockResolvedValue(variante), save: vi.fn(async (fila: unknown) => fila) };
    const inventarioRepo = { find: vi.fn().mockResolvedValue(existencias) };
    const manager = { getRepository: vi.fn((entidad: unknown) => (entidad === VarianteProducto ? varianteRepo : entidad === Inventario ? inventarioRepo : undefined)) };
    return { manager, varianteRepo, inventarioRepo };
  }

  it('bloquea la variante y pondera contra el stock de todos sus almacenes, reservado incluido', async () => {
    const variante = { id: 7, costoPromedio: 20 };
    const { manager, varianteRepo } = crearManager(variante, [
      { stockDisponible: 6, stockReservado: 2 },
      { stockDisponible: 2, stockReservado: 0 },
    ]);

    await registrarCostoDeEntrada(manager as never, 7, 10, 30);

    expect(varianteRepo.findOne).toHaveBeenCalledWith({ where: { id: 7 }, lock: { mode: 'pessimistic_write' } });
    expect(variante.costoPromedio).toBe(25); // (10 x 20 + 10 x 30) / 20
    expect(varianteRepo.save).toHaveBeenCalledWith(variante);
  });

  it('no hace nada sin unidades', async () => {
    const { manager, varianteRepo } = crearManager({ id: 7, costoPromedio: 20 }, []);

    await registrarCostoDeEntrada(manager as never, 7, 0, 30);

    expect(varianteRepo.findOne).not.toHaveBeenCalled();
  });
});

import { NotFoundException } from '@nestjs/common';
import { ProbadorService } from './probador.service.js';
import type { VarianteProducto } from '../../inventario/entities/variante-producto.entity.js';

function variante(overrides: Partial<VarianteProducto> = {}): VarianteProducto {
  return {
    id: 1,
    sku: 'CAM-M-NEG',
    talla: 'M',
    color: 'Negro',
    corte: 'Casual',
    modelo3dUrl: null,
    activo: true,
    producto: {
      id: 7,
      nombre: 'Camisa',
      descripcion: null,
      activo: true,
      categoria: { zonaProbador: 'SUPERIOR' },
      imagenes: [],
    } as never,
    ...overrides,
  } as VarianteProducto;
}

function crearService(varianteRepo: Record<string, ReturnType<typeof vi.fn>> = {}) {
  const repo = {
    findOne: vi.fn(),
    ...varianteRepo,
  };
  return { service: new ProbadorService(repo as never), varianteRepo: repo };
}

describe('ProbadorService', () => {
  describe('variante()', () => {
    it('expone la zonaProbador de la categoría del producto', async () => {
      const { service, varianteRepo } = crearService();
      varianteRepo.findOne.mockResolvedValue(variante({ producto: { id: 7, nombre: 'Falda', descripcion: null, activo: true, categoria: { zonaProbador: 'INFERIOR' }, imagenes: [] } as never }));

      const resultado = await service.variante(1);

      expect(resultado.zonaProbador).toBe('INFERIOR');
    });

    it('sin categoría asociada, asume SUPERIOR por defecto', async () => {
      const { service, varianteRepo } = crearService();
      varianteRepo.findOne.mockResolvedValue(variante({ producto: { id: 7, nombre: 'Camisa', descripcion: null, activo: true, categoria: null, imagenes: [] } as never }));

      const resultado = await service.variante(1);

      expect(resultado.zonaProbador).toBe('SUPERIOR');
    });

    it('rechaza una variante inexistente o inactiva', async () => {
      const { service, varianteRepo } = crearService();
      varianteRepo.findOne.mockResolvedValue(null);

      await expect(service.variante(99)).rejects.toThrow(NotFoundException);
    });
  });
});

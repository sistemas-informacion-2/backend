import { NotFoundException } from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import { ProbadorModelosService } from './probador-modelos.service.js';
import type { VarianteProducto } from '../../inventario/entities/variante-producto.entity.js';

vi.mock('node:fs/promises', () => ({ unlink: vi.fn() }));

const unlinkMock = vi.mocked(unlink);

const MODELO_ANTIGUO = 'http://localhost:3000/uploads/modelos/antiguo.glb';
const MODELO_NUEVO = 'http://localhost:3000/uploads/modelos/nuevo.glb';

function variante(overrides: Partial<VarianteProducto> = {}): VarianteProducto {
  return {
    id: 1,
    idProducto: 7,
    sku: 'CAM-M-NEG',
    talla: 'M',
    color: 'Negro',
    corte: 'Casual',
    modelo3dUrl: null,
    activo: true,
    producto: { id: 7, nombre: 'Camisa' } as never,
    ...overrides,
  } as VarianteProducto;
}

function crearQueryBuilder(rows: VarianteProducto[]) {
  const llamadas: Array<[string, unknown[]]> = [];
  const qb: Record<string, ReturnType<typeof vi.fn>> = {
    innerJoinAndSelect: vi.fn((...args: unknown[]) => {
      llamadas.push(['innerJoinAndSelect', args]);
      return qb;
    }),
    where: vi.fn((...args: unknown[]) => {
      llamadas.push(['where', args]);
      return qb;
    }),
    andWhere: vi.fn((...args: unknown[]) => {
      llamadas.push(['andWhere', args]);
      return qb;
    }),
    setParameter: vi.fn((...args: unknown[]) => {
      llamadas.push(['setParameter', args]);
      return qb;
    }),
    orderBy: vi.fn((...args: unknown[]) => {
      llamadas.push(['orderBy', args]);
      return qb;
    }),
    addOrderBy: vi.fn((...args: unknown[]) => {
      llamadas.push(['addOrderBy', args]);
      return qb;
    }),
    limit: vi.fn((...args: unknown[]) => {
      llamadas.push(['limit', args]);
      return qb;
    }),
    getMany: vi.fn(() => Promise.resolve(rows)),
  };
  return { qb, llamadas };
}

function crearService(overrides: {
  varianteRepo?: Record<string, ReturnType<typeof vi.fn>>;
  rows?: VarianteProducto[];
} = {}) {
  const { qb, llamadas } = crearQueryBuilder(overrides.rows ?? []);
  const varianteRepo = {
    createQueryBuilder: vi.fn(() => qb),
    findOne: vi.fn(),
    save: vi.fn((datos: VarianteProducto) => Promise.resolve(datos)),
    ...overrides.varianteRepo,
  };

  return {
    service: new ProbadorModelosService(varianteRepo as never),
    varianteRepo,
    llamadas,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  unlinkMock.mockResolvedValue(undefined);
});

describe('ProbadorModelosService', () => {
  describe('variantes()', () => {
    it('lista solo variantes con producto activo y mapea la vista admin', async () => {
      const { service, llamadas } = crearService({
        rows: [variante(), variante({ id: 2, sku: 'CAM-S-BLL', modelo3dUrl: MODELO_NUEVO })],
      });

      const resultado = await service.variantes();

      expect(resultado).toHaveLength(2);
      expect(resultado[0]).toEqual({
        id: 1,
        sku: 'CAM-M-NEG',
        talla: 'M',
        color: 'Negro',
        corte: 'Casual',
        modelo3dUrl: null,
        producto: { id: 7, nombre: 'Camisa' },
      });
      expect(resultado[1].modelo3dUrl).toBe(MODELO_NUEVO);
      expect(llamadas.some(([metodo, args]) => metodo === 'limit' && args[0] === 200)).toBeTruthy();
      expect(llamadas.some(([metodo]) => metodo === 'setParameter')).toBeFalsy();
    });

    it('filtra por busqueda con ILIKE sobre sku, producto, talla y color', async () => {
      const { service, llamadas } = crearService({
        rows: [variante()],
      });

      await service.variantes('  camis neg  ');

      const condicion = llamadas.find(
        ([metodo, args]) => metodo === 'andWhere' && String(args[0]).includes('ILIKE'),
      );
      expect(condicion).toBeTruthy();
      expect(String(condicion![1][0])).toMatch(/v\.sku ILIKE :q|p\.nombre ILIKE :q/);
      expect(llamadas).toContainEqual([
        'setParameter',
        ['q', '%camis neg%'],
      ]);
    });
  });

  describe('asociar()', () => {
    it('guarda la nueva URL y elimina el modelo anterior administrado', async () => {
      const { service, varianteRepo } = crearService();
      varianteRepo.findOne.mockResolvedValue(variante({ modelo3dUrl: MODELO_ANTIGUO }));

      const resultado = await service.asociar(1, MODELO_NUEVO);

      expect(varianteRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { producto: true },
      });
      expect(varianteRepo.save).toHaveBeenCalledWith(expect.objectContaining({ modelo3dUrl: MODELO_NUEVO }));
      expect(unlinkMock).toHaveBeenCalledWith(expect.stringContaining('antiguo.glb'));
      expect(resultado.modelo3dUrl).toBe(MODELO_NUEVO);
    });

    it('no elimina URLs que no administra la app', async () => {
      const { service, varianteRepo } = crearService();
      varianteRepo.findOne.mockResolvedValue(variante({ modelo3dUrl: 'https://externo/otro.glb' }));

      await service.asociar(1, MODELO_NUEVO);

      expect(unlinkMock).not.toHaveBeenCalled();
    });

    it('rechaza una variante inexistente o inactiva', async () => {
      const { service, varianteRepo } = crearService();
      varianteRepo.findOne.mockResolvedValue(null);

      await expect(service.asociar(99, MODELO_NUEVO)).rejects.toThrow(NotFoundException);
      expect(varianteRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('quitar()', () => {
    it('desvincula el modelo y borra el archivo administrado', async () => {
      const { service, varianteRepo } = crearService();
      varianteRepo.findOne.mockResolvedValue(variante({ modelo3dUrl: MODELO_ANTIGUO }));

      const resultado = await service.quitar(1);

      expect(unlinkMock).toHaveBeenCalledWith(expect.stringContaining('antiguo.glb'));
      expect(varianteRepo.save).toHaveBeenCalledWith(expect.objectContaining({ modelo3dUrl: null }));
      expect(resultado.modelo3dUrl).toBeNull();
    });

    it('sin modelo previo no intenta borrar nada', async () => {
      const { service, varianteRepo } = crearService();
      varianteRepo.findOne.mockResolvedValue(variante());

      await service.quitar(1);

      expect(unlinkMock).not.toHaveBeenCalled();
    });

    it('rechaza una variante inexistente', async () => {
      const { service, varianteRepo } = crearService();
      varianteRepo.findOne.mockResolvedValue(null);

      await expect(service.quitar(99)).rejects.toThrow(NotFoundException);
      expect(varianteRepo.save).not.toHaveBeenCalled();
    });
  });
});

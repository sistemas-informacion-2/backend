import { ProductoRepository } from './producto.repository.js';

/** Query builder falso que anota cada condicion. */
function crearRepositorio(idEmpresa = 1) {
  const condiciones: Array<{ sql: string; params?: Record<string, unknown> }> = [];
  const builder: Record<string, unknown> = {};
  for (const metodo of ['leftJoinAndSelect', 'orderBy', 'take']) builder[metodo] = vi.fn(() => builder);
  builder.where = vi.fn((sql: string, params?: Record<string, unknown>) => {
    condiciones.push({ sql, params });
    return builder;
  });
  builder.andWhere = builder.where;
  builder.getMany = vi.fn().mockResolvedValue([]);
  const repo = { createQueryBuilder: vi.fn(() => builder) };
  const tenant = { empresaId: () => idEmpresa };
  return { repositorio: new ProductoRepository(repo as never, tenant as never), condiciones };
}

describe('ProductoRepository: recomendaciones', () => {
  it('completar con otros productos solo trae los de la tienda actual', async () => {
    const { repositorio, condiciones } = crearRepositorio(7);

    await repositorio.findOtrosActivos([3, 4], 6);

    expect(condiciones).toContainEqual({ sql: 'producto.id_empresa = :idEmpresa', params: { idEmpresa: 7 } });
    expect(condiciones).toContainEqual({ sql: 'producto.id NOT IN (:...excluirIds)', params: { excluirIds: [3, 4] } });
  });

  it('los de la misma categoria tambien son solo de la tienda actual', async () => {
    const { repositorio, condiciones } = crearRepositorio(7);

    await repositorio.findRelacionados(2, 3, 6);

    expect(condiciones).toContainEqual({ sql: 'producto.id_empresa = :idEmpresa', params: { idEmpresa: 7 } });
  });
});

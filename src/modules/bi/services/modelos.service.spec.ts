import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { GraficosService } from './graficos.service.js';
import { ModelosService, rangoDeHistoria } from './modelos.service.js';

const ok = (resultado: unknown, grafico: unknown = null) => ({ ok: true, resultado, grafico });

describe('rangoDeHistoria', () => {
  it('toma 24 meses completos, sin el mes en curso', () => {
    expect(rangoDeHistoria('2026-11-08', 'MENSUAL')).toEqual({ desde: '2024-11-01', hasta: '2026-10-31' });
  });

  it('toma 52 semanas completas, de lunes a domingo, sin la semana en curso', () => {
    // 2026-11-08 es domingo: la semana en curso empezo el lunes 2.
    expect(rangoDeHistoria('2026-11-08', 'SEMANAL')).toEqual({ desde: '2025-11-03', hasta: '2026-11-01' });
    expect(rangoDeHistoria('2026-11-09', 'SEMANAL').hasta).toBe('2026-11-08');
  });
});

describe('ModelosService', () => {
  function crear(ejecutar = vi.fn(), ultima: unknown[] = []) {
    const dataSource = { query: vi.fn(async () => ultima) };
    return { service: new ModelosService(dataSource as never, { ejecutar } as never, { empresaId: () => 7 } as never), ejecutar, dataSource };
  }

  it('el resumen une cada modelo con sus metricas y su tipo', async () => {
    const { service } = crear(vi.fn(), [{ estado: 'OK', inicio: new Date(), fin: null, error: null, metricas: { abandono: { auc: 0.9 }, segmentacion: { omitido: 'pocos datos' } } }]);
    const resumen = await service.resumen();
    expect(resumen.ultimaEjecucion?.estado).toBe('OK');
    expect(resumen.modelos).toHaveLength(6);
    expect(resumen.modelos.find((m) => m.clave === 'abandono')).toMatchObject({ tipo: 'SUPERVISADO', metricas: { auc: 0.9 } });
    expect(resumen.modelos.find((m) => m.clave === 'canasta')).toMatchObject({ tipo: 'NO_SUPERVISADO', metricas: null });
  });

  it('sin entrenamientos el resumen sigue respondiendo', async () => {
    const resumen = await crear().service.resumen();
    expect(resumen.ultimaEjecucion).toBeNull();
    expect(resumen.modelos.every((m) => m.metricas === null)).toBe(true);
  });

  it('el pronostico junta historia y futuro, normalizando los periodos', async () => {
    const ejecutar = vi.fn(async (nombre: string) =>
      nombre === 'pronosticar_ventas'
        ? ok({ filas: [{ periodo: '2026-11-01', valor: 10, bajo: 5, alto: 15, modelo: 'HOLT' }], nota: 'n' }, { tipo: 'linea' })
        : ok({ filas: [{ grupo: '2026-09', ventas: 100 }, { grupo: '2026-10', ventas: 200 }] }),
    );
    const respuesta = await crear(ejecutar).service.pronostico({ categoria: 'Jeans' });
    expect(respuesta).toMatchObject({ frecuencia: 'MENSUAL', disponible: true, modelo: 'HOLT', historia: [{ periodo: '2026-09-01', valor: 100 }, { periodo: '2026-10-01', valor: 200 }] });
    expect(ejecutar).toHaveBeenCalledWith('pronosticar_ventas', { frecuencia: 'MENSUAL', categoria: 'Jeans' }, 7, expect.any(String));
    expect(ejecutar.mock.calls[1][1]).toMatchObject({ agrupar_por: 'mes', categoria: 'Jeans' });
  });

  it('sin modelos entrenados muestra la historia y avisa', async () => {
    const ejecutar = vi.fn(async (nombre: string) => (nombre === 'pronosticar_ventas' ? ok({ filas: [], disponible: false, nota: 'sin entrenar' }) : ok({ filas: [{ grupo: '2026-10', ventas: 1 }] })));
    const respuesta = await crear(ejecutar).service.pronostico({});
    expect(respuesta).toMatchObject({ disponible: false, futuro: [], nota: 'sin entrenar', modelo: null });
    expect(respuesta.historia).toHaveLength(1);
  });

  it('un parametro invalido es un 400, y los filtros vacios no se envian', async () => {
    const ejecutar = vi.fn(async () => ({ ok: false, resultado: { error: 'mal' }, grafico: null }));
    const { service } = crear(ejecutar);
    await expect(service.consultar('segmentos_de_clientes', { limite: undefined, sucursal: '' })).rejects.toThrow(BadRequestException);
    expect(ejecutar).toHaveBeenCalledWith('segmentos_de_clientes', {}, 7, expect.any(String));
  });
});

describe('GraficosService', () => {
  function crear(opciones: { ejecucion?: unknown; guardados?: number; existente?: unknown } = {}) {
    const ejecutar = vi.fn(async () => opciones.ejecucion ?? ok({ filas: [{ a: 1 }] }, { titulo: 'Ventas por mes', tipo: 'linea' }));
    const repo = {
      count: vi.fn(async () => opciones.guardados ?? 0),
      create: vi.fn((d) => d),
      save: vi.fn(async (d) => ({ id: 3, fechaCreacion: new Date(), ...d })),
      find: vi.fn(async () => []),
      findOne: vi.fn(async () => (opciones.existente === undefined ? null : opciones.existente)),
      delete: vi.fn(),
    };
    return { service: new GraficosService(repo as never, { ejecutar } as never, { empresaId: () => 7 } as never), repo, ejecutar };
  }
  const DTO = { herramienta: 'ventas_por_periodo', parametros: { agrupar_por: 'mes' } };

  it('guarda la definicion, nunca los datos, con el titulo de la herramienta si no trae uno', async () => {
    const { service, repo, ejecutar } = crear();
    const guardado = await service.guardar(DTO, 9);
    expect(ejecutar).toHaveBeenCalledWith('ventas_por_periodo', DTO.parametros, 7, expect.any(String));
    expect(repo.save).toHaveBeenCalledWith({ idUsuario: 9, herramienta: 'ventas_por_periodo', parametros: DTO.parametros, titulo: 'Ventas por mes' });
    expect(guardado).not.toHaveProperty('resultado');
  });

  it('respeta el titulo propio', async () => {
    const { service, repo } = crear();
    await service.guardar({ ...DTO, titulo: '  Mi grafico  ' }, 9);
    expect(repo.save.mock.calls[0][0]).toMatchObject({ titulo: 'Mi grafico' });
  });

  it('rechaza herramientas o parametros invalidos', async () => {
    const { service, repo } = crear({ ejecucion: { ok: false, resultado: { error: 'Parametro no permitido: id_empresa' }, grafico: null } });
    await expect(service.guardar(DTO, 9)).rejects.toThrow('Parametro no permitido');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rechaza lo que no se puede dibujar', async () => {
    const { service } = crear({ ejecucion: ok({ filas: [] }) });
    await expect(service.guardar(DTO, 9)).rejects.toThrow('no se puede guardar');
  });

  it('tiene un tope por usuario', async () => {
    const { service, repo } = crear({ guardados: 50 });
    await expect(service.guardar(DTO, 9)).rejects.toThrow(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('solo abre o borra los propios, en su empresa', async () => {
    const { service, repo } = crear({ existente: null });
    await expect(service.datos(3, 9)).rejects.toThrow(NotFoundException);
    await expect(service.borrar(3, 9)).rejects.toThrow(NotFoundException);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 3, idEmpresa: 7, idUsuario: 9 } });
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('al abrir vuelve a calcular con la empresa actual', async () => {
    const existente = { id: 3, titulo: 't', herramienta: 'ventas_por_periodo', parametros: DTO.parametros, fechaCreacion: new Date() };
    const { service, ejecutar } = crear({ existente });
    const datos = await service.datos(3, 9);
    expect(ejecutar).toHaveBeenCalledWith('ventas_por_periodo', DTO.parametros, 7, expect.any(String));
    expect(datos.resultado.filas).toHaveLength(1);
    expect(datos.grafico).toMatchObject({ tipo: 'linea' });
  });
});

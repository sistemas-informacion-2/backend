import { ConflictException } from '@nestjs/common';
import { EtlService } from './etl.service.js';
import { EtlProgramadoService } from './etl-programado.service.js';
import { CARGAS_ETL } from './cargas/index.js';

function crear(opciones: { bloqueoLibre?: boolean; fallaEn?: string } = {}) {
  const enTransaccion: string[] = [];
  let transaccionActiva = false;
  const queryRunner = {
    connect: vi.fn(),
    startTransaction: vi.fn(() => {
      transaccionActiva = true;
    }),
    commitTransaction: vi.fn(() => {
      transaccionActiva = false;
    }),
    rollbackTransaction: vi.fn(() => {
      transaccionActiva = false;
    }),
    get isTransactionActive() {
      return transaccionActiva;
    },
    release: vi.fn(),
    query: vi.fn(async (sql: string) => {
      enTransaccion.push(sql.trim());
      if (sql.includes('pg_try_advisory_xact_lock')) return [{ libre: opciones.bloqueoLibre ?? true }];
      if (opciones.fallaEn && sql.includes(`INSERT INTO dw.${opciones.fallaEn} `)) throw new Error(`fallo cargando ${opciones.fallaEn}`);
      if (sql.startsWith('SELECT count(*)')) return [{ n: 3 }];
      return [];
    }),
  };
  const bitacora: Array<{ sql: string; params: unknown[] }> = [];
  const dataSource = {
    createQueryRunner: () => queryRunner,
    query: vi.fn(async (sql: string, params: unknown[]) => {
      bitacora.push({ sql, params });
      return sql.includes('INSERT INTO dw.etl_ejecucion') ? [{ id: 41 }] : [];
    }),
  };
  const avisoMl = { cargaTerminada: vi.fn() };
  const service = new EtlService(dataSource as never, avisoMl as never);
  return { service, queryRunner, enTransaccion, bitacora, avisoMl };
}

describe('EtlService.ejecutar', () => {
  it('carga dimensiones y despues hechos (borrando antes los de la empresa) en una transaccion, y registra la carga', async () => {
    const { service, queryRunner, enTransaccion, bitacora, avisoMl } = crear();

    const resumen = await service.ejecutar(7, 'MANUAL', 9);

    const tablas = enTransaccion.filter((sql) => sql.startsWith('INSERT INTO dw.')).map((sql) => sql.split(' ')[2].replace('dw.', ''));
    expect(tablas).toEqual(CARGAS_ETL.map((c) => c.tabla));
    expect(tablas.slice(0, 5).every((t) => t.startsWith('dim_'))).toBe(true);
    // Solo los hechos se borran, y siempre de la empresa (parametro), antes de volver a insertarlos.
    const borrados = enTransaccion.filter((sql) => sql.startsWith('DELETE'));
    expect(borrados).toHaveLength(CARGAS_ETL.filter((c) => c.tipo === 'HECHO').length);
    expect(borrados.every((sql) => sql.includes('WHERE id_empresa = $1') && sql.includes('fact_'))).toBe(true);
    expect(enTransaccion.indexOf('DELETE FROM dw.fact_ventas WHERE id_empresa = $1')).toBeLessThan(enTransaccion.findIndex((sql) => sql.startsWith('INSERT INTO dw.fact_ventas')));
    expect(queryRunner.query.mock.calls.filter(([, params]) => params !== undefined).every(([, params]) => (params as unknown[]).includes(7))).toBe(true);
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();

    expect(bitacora[0].params).toEqual([7, 'MANUAL', 9]);
    expect(bitacora[1].params[1]).toBe('OK');
    const filasRegistradas = JSON.parse(bitacora[1].params[2] as string);
    expect(filasRegistradas).toMatchObject({ fact_ventas: 3 });
    // dim_fecha la llena la migracion, no el ETL.
    expect(filasRegistradas).not.toHaveProperty('dim_fecha');
    expect(resumen).toMatchObject({ idEjecucion: 41, idEmpresa: 7, origen: 'MANUAL', filas: { fact_ventas: 3, dim_producto: 3 } });
    expect(avisoMl.cargaTerminada).toHaveBeenCalledWith(7);
  });

  it('si otra carga de la misma empresa esta en curso responde 409 sin tocar nada', async () => {
    const { service, queryRunner, bitacora, avisoMl } = crear({ bloqueoLibre: false });

    await expect(service.ejecutar(7, 'MANUAL')).rejects.toThrow(ConflictException);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(bitacora).toHaveLength(0);
    expect(avisoMl.cargaTerminada).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it('un error deshace toda la carga, queda en la bitacora y no se avisa al servicio de ML', async () => {
    const { service, queryRunner, bitacora, avisoMl } = crear({ fallaEn: 'fact_pagos' });

    await expect(service.ejecutar(7, 'PROGRAMADO')).rejects.toThrow('fallo cargando fact_pagos');

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(bitacora[1].params).toEqual([41, 'ERROR', null, 'fallo cargando fact_pagos']);
    expect(avisoMl.cargaTerminada).not.toHaveBeenCalled();
  });
});

describe('EtlProgramadoService.cargarTodas', () => {
  it('carga cada empresa activa y sigue aunque una falle', async () => {
    const etl = { ejecutar: vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({}) };
    const dataSource = { query: vi.fn().mockResolvedValue([{ id: 1, slug: 'a' }, { id: 2, slug: 'b' }, { id: 3, slug: 'c' }]) };
    const config = { get: () => ({ etlProgramado: false, etlCron: '0 2 * * *' }) };
    const programado = new EtlProgramadoService(etl as never, dataSource as never, { addCronJob: vi.fn() } as never, config as never);

    expect(await programado.cargarTodas()).toBe(2);
    expect(etl.ejecutar.mock.calls.map(([id, origen]) => [id, origen])).toEqual([
      [1, 'PROGRAMADO'],
      [2, 'PROGRAMADO'],
      [3, 'PROGRAMADO'],
    ]);
    expect(dataSource.query.mock.calls[0][0]).toContain("estado = 'ACTIVA'");
  });

  it('con BI_ETL_PROGRAMADO=false no programa nada; con un cron invalido no rompe el arranque', () => {
    const scheduler = { addCronJob: vi.fn() };
    new EtlProgramadoService({} as never, {} as never, scheduler as never, { get: () => ({ etlProgramado: false, etlCron: '0 2 * * *' }) } as never).onModuleInit();
    expect(scheduler.addCronJob).not.toHaveBeenCalled();

    const invalido = new EtlProgramadoService({} as never, {} as never, scheduler as never, { get: () => ({ etlProgramado: true, etlCron: 'no es cron' }) } as never);
    expect(() => invalido.onModuleInit()).not.toThrow();
    expect(scheduler.addCronJob).not.toHaveBeenCalled();
  });
});

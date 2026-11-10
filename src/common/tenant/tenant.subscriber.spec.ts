import { ForbiddenException } from '@nestjs/common';
import { TenantSubscriber } from './tenant.subscriber.js';

function crearSubscriber(empresaActual: number | null) {
  const dataSource = { subscribers: [] as unknown[] };
  const tenant = { empresa: () => (empresaActual === null ? null : { id: empresaActual }) };
  const subscriber = new TenantSubscriber(dataSource as never, tenant as never);
  return { subscriber, dataSource };
}

function evento(entity: { idEmpresa?: number | null }, conColumnaEmpresa = true) {
  return {
    entity,
    metadata: { tableName: 'producto', findColumnWithPropertyName: () => (conColumnaEmpresa ? {} : undefined) },
  } as never;
}

describe('TenantSubscriber', () => {
  it('se registra en el DataSource', () => {
    const { subscriber, dataSource } = crearSubscriber(1);

    expect(dataSource.subscribers).toContain(subscriber);
  });

  it('completa la empresa del contexto cuando la entidad no trae una', () => {
    const { subscriber } = crearSubscriber(4);
    const entidad: { idEmpresa?: number | null } = {};

    subscriber.beforeInsert(evento(entidad));

    expect(entidad.idEmpresa).toBe(4);
  });

  it('acepta una entidad que ya trae la misma empresa', () => {
    const { subscriber } = crearSubscriber(4);
    const entidad = { idEmpresa: 4 };

    expect(() => subscriber.beforeInsert(evento(entidad))).not.toThrow();
  });

  it('rechaza crear una fila para otra empresa', () => {
    const { subscriber } = crearSubscriber(4);

    expect(() => subscriber.beforeInsert(evento({ idEmpresa: 7 }))).toThrow(ForbiddenException);
  });

  it('sin empresa en el contexto (seeders) respeta lo que trae la entidad', () => {
    const { subscriber } = crearSubscriber(null);
    const entidad: { idEmpresa?: number | null } = { idEmpresa: 7 };

    subscriber.beforeInsert(evento(entidad));

    expect(entidad.idEmpresa).toBe(7);
  });

  it('ignora entidades sin columna de empresa', () => {
    const { subscriber } = crearSubscriber(4);
    const entidad: { idEmpresa?: number | null } = {};

    subscriber.beforeInsert(evento(entidad, false));

    expect(entidad.idEmpresa).toBeUndefined();
  });
});

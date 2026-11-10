import { ahora, fijarReloj, relojSimulado } from './reloj.js';
import { RelojSubscriber } from '../tenant/reloj.subscriber.js';

describe('reloj', () => {
  const entornoOriginal = process.env.NODE_ENV;
  afterEach(() => {
    fijarReloj(null);
    process.env.NODE_ENV = entornoOriginal;
  });

  it('por defecto da la hora real', () => {
    const antes = Date.now();
    expect(relojSimulado()).toBe(false);
    expect(ahora().getTime()).toBeGreaterThanOrEqual(antes);
  });

  it('simulado devuelve la fecha fijada y una copia nueva cada vez', () => {
    const fecha = new Date(2025, 11, 24, 18, 30);
    fijarReloj(fecha);
    const a = ahora();
    a.setFullYear(1999);
    expect(ahora().getTime()).toBe(fecha.getTime());
    expect(relojSimulado()).toBe(true);
  });

  it('no se puede simular en produccion', () => {
    process.env.NODE_ENV = 'production';
    expect(() => fijarReloj(new Date(2025, 0, 1))).toThrow('produccion');
    expect(relojSimulado()).toBe(false);
  });
});

describe('RelojSubscriber', () => {
  const metadata = {
    columns: [
      { propertyName: 'fechaHora', default: () => 'CURRENT_TIMESTAMP', isCreateDate: false, isUpdateDate: false },
      { propertyName: 'fechaCreacion', default: undefined, isCreateDate: true, isUpdateDate: false },
      { propertyName: 'fechaAsignacion', default: () => 'CURRENT_DATE', isCreateDate: false, isUpdateDate: false },
      { propertyName: 'estado', default: 'PENDIENTE', isCreateDate: false, isUpdateDate: false },
    ],
  };
  const subscriber = new RelojSubscriber({ subscribers: [] } as never);
  afterEach(() => fijarReloj(null));

  it('con el reloj real deja que la base ponga la fecha', () => {
    const entity: Record<string, unknown> = {};
    subscriber.beforeInsert({ entity, metadata } as never);
    expect(entity).toEqual({});
  });

  it('con el reloj simulado llena las fechas por defecto que vienen vacias, sin pisar las que ya traen valor', () => {
    const simulada = new Date(2025, 5, 10, 11, 0);
    const propia = new Date(2025, 5, 1);
    fijarReloj(simulada);
    const entity: Record<string, unknown> = { fechaCreacion: propia };

    subscriber.beforeInsert({ entity, metadata } as never);

    expect(entity.fechaHora).toEqual(simulada);
    expect(entity.fechaAsignacion).toEqual(simulada);
    expect(entity.fechaCreacion).toBe(propia);
    expect(entity.estado).toBeUndefined();
  });
});

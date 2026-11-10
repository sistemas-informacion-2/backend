import { ConflictException, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import type { Repository } from 'typeorm';
import type { SolicitudIdempotente } from '../entities/solicitud-idempotente.entity.js';
import { IdempotenciaInterceptor, type RequestConIdempotencia } from './idempotencia.interceptor.js';

const CLAVE = '11111111-2222-3333-4444-555555555555';

function preparar(opciones: { reservada: boolean; previa?: Partial<SolicitudIdempotente> | null; headers?: Record<string, string>; metodo?: string }) {
  const request = {
    method: opciones.metodo ?? 'POST',
    user: { sub: 7 },
    headers: opciones.headers ?? { 'idempotency-key': CLAVE },
  } as unknown as RequestConIdempotencia;
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
  const consulta = {
    insert: () => consulta,
    values: () => consulta,
    orIgnore: () => consulta,
    returning: () => consulta,
    execute: vi.fn().mockResolvedValue({ raw: opciones.reservada ? [{ clave: CLAVE }] : [] }),
  };
  const repo = {
    createQueryBuilder: () => consulta,
    findOneBy: vi.fn().mockResolvedValue(opciones.previa ?? null),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  return { request, context, repo, interceptor: new IdempotenciaInterceptor(repo as unknown as Repository<SolicitudIdempotente>) };
}

describe('IdempotenciaInterceptor', () => {
  it('no interviene si la peticion no trae la cabecera', async () => {
    const { interceptor, context, repo } = preparar({ reservada: true, headers: {} });
    const handle = vi.fn(() => of('ok'));
    await expect(lastValueFrom(interceptor.intercept(context, { handle } as CallHandler))).resolves.toBe('ok');
    expect(handle).toHaveBeenCalledTimes(1);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('la primera vez ejecuta y guarda la respuesta', async () => {
    const { interceptor, context, repo } = preparar({ reservada: true });
    const handle = vi.fn(() => of({ id: 10 }));
    await expect(lastValueFrom(interceptor.intercept(context, { handle } as CallHandler))).resolves.toEqual({ id: 10 });
    expect(repo.update).toHaveBeenCalledWith({ clave: CLAVE }, { estado: 'COMPLETADA', respuesta: { id: 10 } });
  });

  it('si se reenvia, devuelve la respuesta original sin ejecutar otra vez', async () => {
    const { interceptor, context, request } = preparar({ reservada: false, previa: { idUsuario: 7, estado: 'COMPLETADA', respuesta: { id: 10 } } });
    const handle = vi.fn(() => of({ id: 99 }));
    await expect(lastValueFrom(interceptor.intercept(context, { handle } as CallHandler))).resolves.toEqual({ id: 10 });
    expect(handle).not.toHaveBeenCalled();
    expect(request.respuestaRepetida).toBe(true);
  });

  it('libera la clave si la operacion falla, para poder reintentar', async () => {
    const { interceptor, context, repo } = preparar({ reservada: true });
    const fallo = new ConflictException('La sucursal no tiene una caja abierta');
    const handle = vi.fn(() => throwError(() => fallo));
    await expect(lastValueFrom(interceptor.intercept(context, { handle } as CallHandler))).rejects.toBe(fallo);
    expect(repo.delete).toHaveBeenCalledWith({ clave: CLAVE });
  });

  it('rechaza una clave en proceso y no la vuelve a ejecutar', async () => {
    const { interceptor, context } = preparar({ reservada: false, previa: { idUsuario: 7, estado: 'EN_PROCESO', respuesta: null } });
    const handle = vi.fn(() => of('ok'));
    await expect(lastValueFrom(interceptor.intercept(context, { handle } as CallHandler))).rejects.toBeInstanceOf(ConflictException);
    expect(handle).not.toHaveBeenCalled();
  });

  it('no entrega a un usuario la respuesta guardada de otro', async () => {
    const { interceptor, context } = preparar({ reservada: false, previa: { idUsuario: 8, estado: 'COMPLETADA', respuesta: { id: 10 } } });
    const handle = vi.fn(() => of('ok'));
    await expect(lastValueFrom(interceptor.intercept(context, { handle } as CallHandler))).rejects.toBeInstanceOf(ConflictException);
  });
});

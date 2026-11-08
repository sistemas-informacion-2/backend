import { BadRequestException, ConflictException, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { catchError, from, mergeMap, of, switchMap, throwError, type Observable } from 'rxjs';
import { LessThan, type Repository } from 'typeorm';
import type { ActiveUser } from '../../modules/acceso/types/jwt-payload.type.js';
import { SolicitudIdempotente } from '../entities/solicitud-idempotente.entity.js';

const CLAVE_VALIDA = /^[A-Za-z0-9-]{8,64}$/;
const DIAS_RETENCION = 30;

export type RequestConIdempotencia = Request & { user?: ActiveUser; respuestaRepetida?: boolean };

/**
 * Las escrituras hechas sin conexion llevan `Idempotency-Key`: si la respuesta se perdio y se reenvian, se devuelve la
 * respuesta original en vez de aplicarlas otra vez. Las peticiones sin esa cabecera no pasan por aqui.
 *
 * Si la clave quedo EN_PROCESO (otra peticion en curso, o el servidor se cayo a mitad) no se puede saber si se aplico:
 * se rechaza para que una persona lo revise, porque repetir una venta es peor que preguntar.
 */
@Injectable()
export class IdempotenciaInterceptor implements NestInterceptor {
  constructor(@InjectRepository(SolicitudIdempotente) private readonly repo: Repository<SolicitudIdempotente>) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestConIdempotencia>();
    const clave = request.headers['idempotency-key'];
    const idUsuario = request.user?.sub;
    if (typeof clave !== 'string' || request.method === 'GET' || idUsuario === undefined) return next.handle();
    if (!CLAVE_VALIDA.test(clave)) return throwError(() => new BadRequestException('Idempotency-Key no es valida'));

    return from(this.reservar(clave, idUsuario)).pipe(
      switchMap((reservada) => {
        if (reservada) return this.ejecutar(clave, next);
        return from(this.respuestaPrevia(clave, idUsuario)).pipe(
          mergeMap((respuesta) => {
            request.respuestaRepetida = true;
            return of(respuesta);
          }),
        );
      }),
    );
  }

  private ejecutar(clave: string, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      mergeMap(async (respuesta: unknown) => {
        await this.repo.update({ clave }, { estado: 'COMPLETADA', respuesta: (respuesta ?? null) as object });
        return respuesta;
      }),
      // Si fallo, la transaccion del servicio no se aplico: la clave se libera para poder reintentar.
      catchError((error: unknown) => from(this.repo.delete({ clave })).pipe(mergeMap(() => throwError(() => error)))),
    );
  }

  private async reservar(clave: string, idUsuario: number): Promise<boolean> {
    const resultado = await this.repo
      .createQueryBuilder()
      .insert()
      .values({ clave, idUsuario, estado: 'EN_PROCESO' })
      .orIgnore()
      .returning('clave')
      .execute();
    const reservada = (resultado.raw as unknown[]).length > 0;
    if (reservada) void this.limpiarAntiguas();
    return reservada;
  }

  private async respuestaPrevia(clave: string, idUsuario: number): Promise<unknown> {
    const previa = await this.repo.findOneBy({ clave });
    if (previa?.idUsuario !== idUsuario || previa.estado !== 'COMPLETADA') {
      throw new ConflictException('No se pudo confirmar si este cambio ya se aplico. Revisa los datos antes de reintentar.');
    }
    return previa.respuesta;
  }

  private async limpiarAntiguas(): Promise<void> {
    const limite = new Date(Date.now() - DIAS_RETENCION * 24 * 60 * 60 * 1000);
    await this.repo.delete({ fechaCreacion: LessThan(limite) }).catch(() => undefined);
  }
}

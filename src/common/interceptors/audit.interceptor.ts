import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { tap, type Observable } from 'rxjs';
import { BitacoraRepository } from '../../modules/acceso/repositories/bitacora.repository.js';
import type { ActiveUser } from '../../modules/acceso/types/jwt-payload.type.js';

const METODOS_AUDITABLES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CAMPOS_SENSIBLES = ['password', 'passwordActual', 'nuevaPassword', 'passwordHash', 'refreshToken'];

/**
 * Registra en BITACORA cada request que muta datos (POST/PUT/PATCH/DELETE).
 * Es deliberadamente genérico: guarda el body como `datos_nuevos` sanitizado
 * de campos sensibles, pero no calcula `datos_anteriores` (eso requiere leer
 * el estado previo de la entidad, algo específico de cada service — se irá
 * completando CU por CU en lugar de adivinarlo acá).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly bitacoraRepo: BitacoraRepository) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: ActiveUser }>();

    if (!METODOS_AUDITABLES.has(request.method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        this.bitacoraRepo
          .registrar({
            idUsuario: request.user?.sub ?? null,
            accion: `${request.method} ${request.originalUrl}`,
            tablaAfectada: this.extraerRecurso(request.originalUrl),
            ipOrigen: request.ip ?? null,
            userAgent: request.headers['user-agent'] ?? null,
            datosNuevos: this.sanitizar(request.body),
          })
          .catch(() => undefined); // la auditoría nunca debe romper la respuesta al cliente
      }),
    );
  }

  private extraerRecurso(url: string): string {
    const segmentos = url.split('?')[0]?.split('/').filter(Boolean) ?? [];
    // /api/<modulo>/<recurso>/... -> nos quedamos con "modulo/recurso"
    return segmentos.slice(1, 3).join('/') || 'desconocido';
  }

  private sanitizar(body: unknown): Record<string, unknown> | null {
    if (!body || typeof body !== 'object') return null;
    const copia = { ...(body as Record<string, unknown>) };
    for (const campo of CAMPOS_SENSIBLES) delete copia[campo];
    return copia;
  }
}

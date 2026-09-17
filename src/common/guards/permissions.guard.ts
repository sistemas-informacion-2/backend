import { Injectable, type CanActivate, type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator.js';
import { ANY_PERMISSIONS_KEY } from '../decorators/require-any-permission.decorator.js';
import type { ActiveUser } from '../../modules/acceso/types/jwt-payload.type.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const anyRequired = this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if ((!required || required.length === 0) && (!anyRequired || anyRequired.length === 0)) return true;

    const request = context.switchToHttp().getRequest();
    const user: ActiveUser | undefined = request.user;
    if (!user) throw new ForbiddenException('No autenticado');

    if (user.tipoUsuario === 'A') return true;

    if (anyRequired?.length > 0 && anyRequired.some((permiso) => user.permisos.includes(permiso))) return true;
    if (anyRequired?.length > 0) throw new ForbiddenException('No tiene permisos suficientes para esta acción');

    const hasPermission = required?.every((permiso) => user.permisos.includes(permiso));
    if (!hasPermission) {
      throw new ForbiddenException('No tiene permisos suficientes para esta acción');
    }
    return true;
  }
}

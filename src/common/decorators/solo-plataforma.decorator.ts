import { SetMetadata } from '@nestjs/common';

export const ES_RUTA_PLATAFORMA = 'esRutaPlataforma';

/**
 * Marca una ruta (o un controller) de la plataforma SaaS: no corre dentro de
 * ninguna empresa y, si no es @Public, solo la usa el superadmin (tipo S).
 * Ver TenantGuard.
 */
export const SoloPlataforma = () => SetMetadata(ES_RUTA_PLATAFORMA, true);

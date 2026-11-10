import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { RequierePlan } from '../../../common/decorators/plan.decorator.js';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { EtlService, type EjecucionEtl, type ResumenEtl } from '../etl/etl.service.js';

@ApiTags('BI')
@RequierePlan('bi')
@Controller('bi/etl')
export class EtlController {
  constructor(
    private readonly etl: EtlService,
    private readonly tenant: TenantContext,
  ) {}

  @Post('ejecutar')
  @HttpCode(200)
  @RequirePermission('analitica:bi:etl')
  @ApiOperation({ summary: 'Carga ahora el Data Warehouse de la empresa con los datos actuales' })
  ejecutar(@CurrentUser() usuario: ActiveUser): Promise<ResumenEtl> {
    return this.etl.ejecutar(this.tenant.empresaId(), 'MANUAL', usuario.sub);
  }

  @Get('historial')
  @RequirePermission('analitica:bi:usar')
  @ApiOperation({ summary: 'Ultimas cargas del Data Warehouse de la empresa' })
  historial(): Promise<EjecucionEtl[]> {
    return this.etl.historial(this.tenant.empresaId());
  }
}

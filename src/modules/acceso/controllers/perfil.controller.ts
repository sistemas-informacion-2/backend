import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { PerfilService } from '../services/perfil.service.js';
import { ActualizarPerfilDto } from '../dto/actualizar-perfil.dto.js';
import { CambiarPasswordDto } from '../dto/cambiar-password.dto.js';
import type { PerfilDto } from '../dto/auth-response.dto.js';
import type { ActiveUser } from '../types/jwt-payload.type.js';

@ApiTags('Perfil')
@Controller('acceso/perfil')
export class PerfilController {
  constructor(private readonly perfilService: PerfilService) {}

  @Get()
  @ApiOperation({ summary: 'Retorna el perfil del usuario autenticado' })
  obtener(@CurrentUser() user: ActiveUser): Promise<PerfilDto> {
    return this.perfilService.obtener(user);
  }

  @Put()
  @ApiOperation({ summary: 'Actualiza los datos personales del propio usuario' })
  actualizar(@CurrentUser() user: ActiveUser, @Body() dto: ActualizarPerfilDto): Promise<PerfilDto> {
    return this.perfilService.actualizar(user, dto);
  }

  @Patch('cambiar-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cambia la contraseña validando la actual' })
  async cambiarPassword(@CurrentUser() user: ActiveUser, @Body() dto: CambiarPasswordDto): Promise<void> {
    await this.perfilService.cambiarPassword(user, dto);
  }
}

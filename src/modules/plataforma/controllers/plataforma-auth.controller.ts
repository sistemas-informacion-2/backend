import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { SoloPlataforma } from '../../../common/decorators/solo-plataforma.decorator.js';
import { AuthService } from '../../acceso/services/auth.service.js';
import { LoginDto } from '../../acceso/dto/login.dto.js';
import type { AuthResponseDto, PerfilDto } from '../../acceso/dto/auth-response.dto.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';

/** Sesion del superadmin. Refresh y logout son los de /acceso/auth: funcionan igual para su token. */
@ApiTags('Plataforma')
@SoloPlataforma()
@Controller('plataforma/auth')
export class PlataformaAuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login del superadmin de la plataforma (sin empresa)' })
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    return this.authService.loginPlataforma(dto, req.ip ?? null, req.headers['user-agent'] ?? null);
  }

  @Get('me')
  @ApiOperation({ summary: 'Perfil del superadmin autenticado' })
  me(@CurrentUser() usuario: ActiveUser): Promise<PerfilDto> {
    return this.authService.mePlataforma(usuario);
  }
}

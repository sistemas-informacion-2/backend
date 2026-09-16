import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { AuthService } from '../services/auth.service.js';
import { LoginDto } from '../dto/login.dto.js';
import { RefreshTokenDto } from '../dto/refresh-token.dto.js';
import type { AuthResponseDto, PerfilDto } from '../dto/auth-response.dto.js';
import type { ActiveUser } from '../types/jwt-payload.type.js';

@ApiTags('Acceso')
@Controller('acceso/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Autentica un usuario y retorna tokens + perfil' })
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    const ip = req.ip ?? null;
    const userAgent = req.headers['user-agent'] ?? null;
    return this.authService.login(dto, ip, userAgent);
  }

  @Get('me')
  @ApiOperation({ summary: 'Retorna el perfil del usuario autenticado' })
  me(@CurrentUser() user: ActiveUser): Promise<PerfilDto> {
    return this.authService.me(user);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rota el par de tokens usando el refresh token' })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cierra la sesión asociada al refresh token' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }
}

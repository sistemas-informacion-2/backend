import { ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import type { AppConfig } from '../../../config/configuration.js';
import { Usuario } from '../entities/usuario.entity.js';
import { UsuarioRepository } from '../repositories/usuario.repository.js';
import { SesionRepository } from '../repositories/sesion.repository.js';
import { ClienteRepository } from '../../operaciones/repositories/cliente.repository.js';
import { ClientesService } from '../../operaciones/services/clientes.service.js';
import { EmpleadoSucursalRepository } from '../repositories/empleado-sucursal.repository.js';
import { extraerPermisos, toPerfilBase } from '../mappers/usuario.mapper.js';
import type { LoginDto } from '../dto/login.dto.js';
import type { RegistroClienteDto } from '../dto/registro-cliente.dto.js';
import type { AuthResponseDto, PerfilDto } from '../dto/auth-response.dto.js';
import type { ActiveUser, JwtPayload } from '../types/jwt-payload.type.js';

const MAX_INTENTOS_FALLIDOS = 5;
/** Tope de registros por direccion IP y hora: frena la creacion masiva de cuentas desde un mismo origen. */
const MAX_REGISTROS_POR_IP_Y_HORA = 10;
const VENTANA_REGISTRO_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly registrosPorIp = new Map<string, number[]>();

  constructor(
    private readonly usuarioRepo: UsuarioRepository,
    private readonly clienteRepo: ClienteRepository,
    private readonly clientesService: ClientesService,
    private readonly sesionRepo: SesionRepository,
    private readonly empleadoSucursalRepo: EmpleadoSucursalRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async login(dto: LoginDto, ipOrigen: string | null, userAgent: string | null): Promise<AuthResponseDto> {
    const usuario = await this.usuarioRepo.findByEmailConRoles(dto.email);

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (usuario.estadoAcceso === 'BLOQUEADO') {
      throw new HttpException('Cuenta bloqueada por intentos fallidos', HttpStatus.LOCKED);
    }
    if (usuario.estadoAcceso === 'SUSPENDIDO') {
      throw new ForbiddenException('Cuenta suspendida');
    }

    const passwordValida = await bcrypt.compare(dto.password, usuario.passwordHash);
    if (!passwordValida) {
      usuario.intentosFallidos += 1;
      if (usuario.intentosFallidos >= MAX_INTENTOS_FALLIDOS) {
        usuario.estadoAcceso = 'BLOQUEADO';
        await this.usuarioRepo.save(usuario);
        throw new HttpException('Cuenta bloqueada por intentos fallidos', HttpStatus.LOCKED);
      }
      await this.usuarioRepo.save(usuario);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    usuario.intentosFallidos = 0;
    await this.usuarioRepo.save(usuario);

    const permisos = extraerPermisos(usuario);
    const sucursalId = await this.obtenerSucursalActiva(usuario);

    return this.emitirTokens(usuario, permisos, sucursalId, ipOrigen, userAgent);
  }

  /** Crea la cuenta de un cliente y lo deja con la sesion iniciada, para que siga con su compra sin volver a entrar. */
  async registrarCliente(dto: RegistroClienteDto, ipOrigen: string | null, userAgent: string | null): Promise<AuthResponseDto> {
    this.validarLimiteRegistros(ipOrigen);
    const email = dto.email.trim().toLowerCase();

    await this.clientesService.crear({
      nombre: dto.nombre,
      apellido: dto.apellido,
      email,
      telefono: dto.telefono,
      password: dto.password,
    });

    return this.login({ email, password: dto.password }, ipOrigen, userAgent);
  }

  private validarLimiteRegistros(ip: string | null): void {
    if (!ip) return;
    const ahora = Date.now();
    const recientes = (this.registrosPorIp.get(ip) ?? []).filter((momento) => ahora - momento < VENTANA_REGISTRO_MS);
    if (recientes.length >= MAX_REGISTROS_POR_IP_Y_HORA) {
      throw new HttpException('Demasiados registros desde esta conexion. Intenta de nuevo mas tarde', HttpStatus.TOO_MANY_REQUESTS);
    }
    recientes.push(ahora);
    this.registrosPorIp.set(ip, recientes);
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    const payload = this.verificarToken(refreshToken);

    const sesionEncontrada = await this.sesionRepo.findVigentePorHash(
      payload.sub,
      this.hashRefreshToken(refreshToken),
    );
    if (!sesionEncontrada) {
      throw new UnauthorizedException('Sesión no encontrada o ya cerrada');
    }

    const usuario = await this.usuarioRepo.findByIdConRoles(payload.sub);
    if (!usuario || !usuario.activo || usuario.estadoAcceso !== 'HABILITADO') {
      throw new UnauthorizedException('Usuario ya no tiene acceso');
    }

    await this.sesionRepo.cerrar(sesionEncontrada);

    const permisos = extraerPermisos(usuario);
    const sucursalId = await this.obtenerSucursalActiva(usuario);

    return this.emitirTokens(usuario, permisos, sucursalId, sesionEncontrada.ipOrigen, sesionEncontrada.userAgent);
  }

  async logout(refreshToken: string): Promise<void> {
    let payload: JwtPayload;
    try {
      payload = this.verificarToken(refreshToken);
    } catch {
      return;
    }

    const sesion = await this.sesionRepo.findAbiertaPorHash(payload.sub, this.hashRefreshToken(refreshToken));
    if (sesion) await this.sesionRepo.cerrar(sesion);
  }

  async me(activeUser: ActiveUser): Promise<PerfilDto> {
    const usuario = await this.usuarioRepo.findById(activeUser.sub);
    if (!usuario) throw new UnauthorizedException('Usuario no encontrado');
    return this.construirPerfil(usuario, activeUser.permisos, activeUser.sucursalId);
  }

  private verificarToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify<JwtPayload>(token, {
        secret: this.config.get('jwt.secret', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }

  private async obtenerSucursalActiva(usuario: Usuario): Promise<number | undefined> {
    if (usuario.tipoUsuario !== 'E') return undefined;
    const asignacion = await this.empleadoSucursalRepo.findActivaPorEmpleado(usuario.id);
    return asignacion?.idSucursal;
  }

  private async emitirTokens(
    usuario: Usuario,
    permisos: string[],
    sucursalId: number | undefined,
    ipOrigen: string | null,
    userAgent: string | null,
  ): Promise<AuthResponseDto> {
    const payload: JwtPayload = {
      sub: usuario.id,
      tipoUsuario: usuario.tipoUsuario,
      permisos,
      sucursalId,
      jti: randomUUID(),
    };

    const accessExpiration = this.config.get('jwt.accessExpiration', { infer: true });
    const refreshExpiration = this.config.get('jwt.refreshExpiration', { infer: true });

    const accessToken = this.jwtService.sign(payload, { expiresIn: accessExpiration } as any);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: refreshExpiration } as any);

    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const fechaExpiracion = new Date(Date.now() + this.parseDuracionMs(refreshExpiration));

    await this.sesionRepo.crear({
      idUsuario: usuario.id,
      refreshTokenHash,
      ipOrigen,
      userAgent,
      fechaExpiracion,
    });

    const perfil = await this.construirPerfil(usuario, permisos, sucursalId);
    return { accessToken, refreshToken, perfil };
  }

  private async construirPerfil(
    usuario: Usuario,
    permisos: string[],
    sucursalId: number | undefined,
  ): Promise<PerfilDto> {
    const perfil = toPerfilBase(usuario, permisos);

    if (usuario.tipoUsuario === 'E' && sucursalId) {
      const asignacion = await this.empleadoSucursalRepo.findActivaPorSucursalConDatos(sucursalId);
      perfil.sucursalId = sucursalId;
      perfil.sucursalNombre = asignacion?.sucursal?.nombre;
    }

    if (usuario.tipoUsuario === 'C') {
      const cliente = await this.clienteRepo.findByUsuarioId(usuario.id);
      perfil.puntosFidelidad = cliente?.puntosFidelidad ?? 0;
      perfil.direccion = cliente?.direccionPrincipal ?? null;
    }

    return perfil;
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDuracionMs(duracion: string): number {
    const match = /^(\d+)([smhd])$/.exec(duracion);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const valor = Number(match[1]);
    const unidad = match[2];
    const factores: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return valor * factores[unidad];
  }
}

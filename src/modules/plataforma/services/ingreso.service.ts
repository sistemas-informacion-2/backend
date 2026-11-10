import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, In } from 'typeorm';
import { Usuario } from '../../acceso/entities/usuario.entity.js';
import type { IngresoTiendasDto, TiendaDeUsuarioDto } from '../dto/registro.dto.js';

const MAX_INTENTOS_POR_IP = 10;
const VENTANA_MS = 15 * 60 * 1000;
/** Hash de una contrasena cualquiera: se compara igual cuando el correo no existe, para que tarde lo mismo. */
const HASH_DE_RELLENO = bcrypt.hashSync('relleno-para-igualar-tiempos', 10);

/**
 * Login desde el portal de DOMINATR con solo correo y contrasena. Como un correo puede ser personal de varias
 * tiendas, devuelve las tiendas donde esas credenciales son validas; despues el frontend inicia sesion en la
 * elegida con el login normal de la tienda (que es el que cuenta intentos y bloquea cuentas).
 *
 * No revela si un correo existe: sin coincidencias responde siempre el mismo error.
 */
@Injectable()
export class IngresoService {
  private readonly intentosPorIp = new Map<string, number[]>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async tiendas(dto: IngresoTiendasDto, ip: string | null): Promise<TiendaDeUsuarioDto[]> {
    this.limitarPorIp(ip);
    const cuentas = await this.dataSource.getRepository(Usuario).find({
      where: { email: dto.email, tipoUsuario: In(['A', 'E']), activo: true },
      relations: { empresa: true },
    });

    const tiendas: TiendaDeUsuarioDto[] = [];
    for (const cuenta of cuentas) {
      // Una cuenta suspendida o de una tienda suspendida no entra; una bloqueada si se lista y el login de la tienda
      // le explica el bloqueo.
      if (!cuenta.empresa || cuenta.empresa.estado !== 'ACTIVA' || cuenta.estadoAcceso === 'SUSPENDIDO') continue;
      if (!(await bcrypt.compare(dto.password, cuenta.passwordHash))) continue;
      tiendas.push({
        slug: cuenta.empresa.slug,
        nombre: cuenta.empresa.nombre,
        logoUrl: cuenta.empresa.logoUrl,
        tipoUsuario: cuenta.tipoUsuario as 'A' | 'E',
      });
    }
    if (cuentas.length === 0) await bcrypt.compare(dto.password, HASH_DE_RELLENO);

    if (tiendas.length === 0) throw new UnauthorizedException('Correo o contraseña incorrectos');
    return tiendas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  private limitarPorIp(ip: string | null): void {
    if (!ip) return;
    const momento = Date.now();
    const recientes = (this.intentosPorIp.get(ip) ?? []).filter((instante) => momento - instante < VENTANA_MS);
    if (recientes.length >= MAX_INTENTOS_POR_IP) {
      throw new HttpException('Demasiados intentos de ingreso. Espera unos minutos e intenta de nuevo.', HttpStatus.TOO_MANY_REQUESTS);
    }
    recientes.push(momento);
    this.intentosPorIp.set(ip, recientes);
  }
}

import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { EstadoVigencia } from '../../../common/tenant/plan-vigencia.js';
import type { EstadoEmpresa } from '../entities/empresa.entity.js';
import type { CodigoPlan } from '../entities/plan.entity.js';
import { CODIGOS_PLAN } from './plan.dto.js';

/** Slugs que chocarian con rutas del frontend o del backend. */
export const SLUGS_RESERVADOS = ['admin', 'api', 'docs', 'ingresar', 'plataforma', 'registro', 'static', 't', 'uploads', 'www'];

export class AdministradorEmpresaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellido: string;

  @IsEmail()
  @MaxLength(150)
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

/** Alta manual desde el panel del superadmin. */
export class CrearEmpresaDto {
  /** Parte de la URL de la tienda (/t/:slug); no se puede cambiar despues. */
  @IsString()
  @Length(3, 60)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'El slug solo admite minusculas, numeros y guiones (ej. moda-andina)' })
  slug: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  razonSocial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  nit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ciudad?: string;

  /** Plan con que arranca; por defecto la prueba gratuita. */
  @IsOptional()
  @IsIn(CODIGOS_PLAN, { message: 'El plan indicado no existe' })
  codigoPlan?: CodigoPlan;

  /** Cortesia del superadmin: el plan no vence. */
  @IsOptional()
  @IsBoolean()
  sinVencimiento?: boolean;

  @ValidateNested()
  @Type(() => AdministradorEmpresaDto)
  admin: AdministradorEmpresaDto;
}

export class ActualizarEmpresaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  razonSocial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  nit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ciudad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'El color debe tener el formato #RRGGBB' })
  colorPrimario?: string;
}

export class CambiarEstadoEmpresaDto {
  @IsIn(['ACTIVA', 'SUSPENDIDA'])
  estado: EstadoEmpresa;
}

/** El superadmin cambia el plan y/o fija el vencimiento a mano (cortesia, pago fuera de Stripe, correcciones). */
export class CambiarPlanEmpresaDto {
  @IsIn(CODIGOS_PLAN, { message: 'El plan indicado no existe' })
  codigoPlan: CodigoPlan;

  /** Fecha ISO (AAAA-MM-DD o completa) hasta la que queda pagado; null = sin vencimiento. */
  @ValidateIf((_, valor) => valor !== null)
  @IsDateString({}, { message: 'La fecha de vencimiento no es válida' })
  venceEl: string | null;
}

export interface EmpresaResponseDto {
  id: number;
  slug: string;
  nombre: string;
  razonSocial: string | null;
  nit: string | null;
  pais: string;
  ciudad: string | null;
  direccion: string | null;
  telefono: string | null;
  logoUrl: string | null;
  colorPrimario: string | null;
  estado: EstadoEmpresa;
  plan: { codigo: CodigoPlan; nombre: string };
  planVenceEl: Date | null;
  vigencia: EstadoVigencia;
  fechaCreacion: Date;
}

/** Lo que la tienda publica necesita para mostrarse (sin token). */
export interface EmpresaPublicaResponseDto {
  slug: string;
  nombre: string;
  logoUrl: string | null;
  colorPrimario: string | null;
  estado: EstadoEmpresa;
  /** false si el plan vencio (pasada la gracia): la tienda publica muestra "no disponible", el panel sigue entrando a Mi plan. */
  planVigente: boolean;
}

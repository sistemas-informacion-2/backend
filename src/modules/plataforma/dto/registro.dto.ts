import { Transform, Type } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Length, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import type { CodigoPlan } from '../entities/plan.entity.js';
import { CODIGOS_PLAN } from './plan.dto.js';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const minusculas = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

/** Paises admitidos por ahora: el NIT, la moneda y la zona horaria son de Bolivia. */
export const PAISES_ADMITIDOS = ['Bolivia'];

/** Paso 2 del registro: datos legales y operativos de la empresa. */
export class EmpresaRegistroDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'La razón social es obligatoria' })
  @MaxLength(150)
  razonSocial: string;

  /** Nombre comercial / marca; si viene vacio se usa la razon social. */
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(120)
  nombreComercial?: string;

  @Transform(recortar)
  @Matches(/^\d{5,15}$/, { message: 'El NIT solo admite números (entre 5 y 15 dígitos)' })
  nit: string;

  @Transform(recortar)
  @IsIn(PAISES_ADMITIDOS, { message: 'Por ahora DOMINATR solo opera en Bolivia' })
  pais: string;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'La ciudad es obligatoria' })
  @MaxLength(80)
  ciudad: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(200)
  direccion?: string;

  @IsOptional()
  @Transform(recortar)
  @Matches(/^[\d +()-]{6,20}$/, { message: 'El teléfono solo admite números, espacios, + ( ) y -' })
  telefono?: string;

  /** Direccion de la tienda (/t/:slug). No se puede cambiar despues. */
  @Transform(minusculas)
  @IsString()
  @Length(3, 60, { message: 'La dirección de la tienda debe tener entre 3 y 60 caracteres' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'La dirección de la tienda solo admite minúsculas, números y guiones (ej. moda-andina)' })
  slug: string;
}

/** Paso 3 del registro: el administrador general de la empresa. */
export class AdministradorRegistroDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100)
  nombre: string;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  @MaxLength(100)
  apellido: string;

  @Transform(minusculas)
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(150)
  email: string;

  @IsOptional()
  @Transform(recortar)
  @Matches(/^[\d +()-]{6,20}$/, { message: 'El celular solo admite números, espacios, + ( ) y -' })
  telefono?: string;

  /** 72 es el maximo que bcrypt procesa; mas alla los caracteres se ignorarian en silencio. */
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'La contraseña debe combinar letras y números' })
  password: string;
}

export class RegistroEmpresaDto {
  @IsIn(CODIGOS_PLAN, { message: 'El plan indicado no existe' })
  codigoPlan: CodigoPlan;

  @ValidateNested()
  @Type(() => EmpresaRegistroDto)
  empresa: EmpresaRegistroDto;

  @ValidateNested()
  @Type(() => AdministradorRegistroDto)
  admin: AdministradorRegistroDto;
}

export class ConfirmarPagoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  sessionId: string;
}

/**
 * Respuesta del registro: con la prueba gratuita la tienda ya existe (`tienda`); con un plan de pago hay que ir a
 * Stripe (`urlPago`) y la tienda se crea al confirmar.
 */
export interface RegistroResponseDto {
  urlPago: string | null;
  tienda: TiendaCreadaDto | null;
}

export interface TiendaCreadaDto {
  slug: string;
  nombre: string;
  adminEmail: string;
  codigoPlan: CodigoPlan;
  planNombre: string;
  venceEl: Date | null;
}

export interface SlugDisponibleResponseDto {
  slug: string;
  disponible: boolean;
  motivo: string | null;
}

export class IngresoTiendasDto {
  @Transform(minusculas)
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(150)
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MaxLength(72)
  password: string;
}

/** Una tienda donde el correo y la contrasena son validos (login desde el portal). */
export interface TiendaDeUsuarioDto {
  slug: string;
  nombre: string;
  logoUrl: string | null;
  tipoUsuario: 'A' | 'E';
}

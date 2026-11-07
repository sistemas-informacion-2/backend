import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Length, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import type { EstadoEmpresa } from '../entities/empresa.entity.js';

/** Slugs que chocarian con rutas del frontend o del backend. */
export const SLUGS_RESERVADOS = ['admin', 'api', 'docs', 'plataforma', 'static', 't', 'uploads', 'www'];

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

export interface EmpresaResponseDto {
  id: number;
  slug: string;
  nombre: string;
  razonSocial: string | null;
  nit: string | null;
  logoUrl: string | null;
  colorPrimario: string | null;
  estado: EstadoEmpresa;
  fechaCreacion: Date;
}

/** Lo que la tienda publica necesita para mostrarse (sin token). */
export interface EmpresaPublicaResponseDto {
  slug: string;
  nombre: string;
  logoUrl: string | null;
  colorPrimario: string | null;
  estado: EstadoEmpresa;
}

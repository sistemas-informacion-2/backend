import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class ActualizarProveedorDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  empresa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombreContacto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefonoContacto?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  correoContacto?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

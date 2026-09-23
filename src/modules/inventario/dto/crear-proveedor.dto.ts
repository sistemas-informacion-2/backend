import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CrearProveedorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  empresa: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nit: string;

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
}

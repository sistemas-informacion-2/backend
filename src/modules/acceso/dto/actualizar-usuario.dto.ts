import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class ActualizarUsuarioDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  apellido?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telefono?: string | null;

  @IsOptional()
  @IsIn(['M', 'F', 'O'])
  sexo?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsIn(['A', 'E', 'C'])
  tipoUsuario?: 'A' | 'E' | 'C';

  @IsOptional()
  @IsIn(['HABILITADO', 'BLOQUEADO', 'SUSPENDIDO'])
  estadoAcceso?: 'HABILITADO' | 'BLOQUEADO' | 'SUSPENDIDO';

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

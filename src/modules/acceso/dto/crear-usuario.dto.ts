import { IsArray, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CrearUsuarioDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  apellido: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsIn(['M', 'F', 'O'])
  sexo?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsIn(['A', 'E', 'C'])
  tipoUsuario: 'A' | 'E' | 'C';

  @IsOptional()
  @IsIn(['HABILITADO', 'BLOQUEADO', 'SUSPENDIDO'])
  estadoAcceso?: 'HABILITADO' | 'BLOQUEADO' | 'SUSPENDIDO';

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  roles?: number[];
}

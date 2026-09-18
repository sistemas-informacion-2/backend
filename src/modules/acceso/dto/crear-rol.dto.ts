import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CrearRolDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;
}

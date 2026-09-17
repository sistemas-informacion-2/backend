import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ActualizarRolDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ActualizarRolDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

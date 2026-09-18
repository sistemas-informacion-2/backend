import { IsBoolean, IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class ActualizarImagenProductoDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsBoolean()
  esPrincipal?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  orden?: number;
}

import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class CrearImagenProductoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  url: string;

  @IsOptional()
  @IsBoolean()
  esPrincipal?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  orden?: number;
}

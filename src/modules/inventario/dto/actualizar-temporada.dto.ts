import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class ActualizarTemporadaDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;
}

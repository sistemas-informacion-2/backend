import { IsBoolean, IsOptional } from 'class-validator';

export class ActualizarDisponibilidadPasarelaDto {
  @IsOptional()
  @IsBoolean()
  presencial?: boolean;

  @IsOptional()
  @IsBoolean()
  linea?: boolean;
}

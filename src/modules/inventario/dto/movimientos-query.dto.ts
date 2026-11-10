import { IsOptional, Matches } from 'class-validator';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Rango opcional del kardex, en fechas de Bolivia (AAAA-MM-DD). Sin rango se devuelven los ultimos movimientos. */
export class MovimientosQueryDto {
  @IsOptional()
  @Matches(FECHA, { message: 'La fecha "desde" debe tener el formato AAAA-MM-DD' })
  desde?: string;

  @IsOptional()
  @Matches(FECHA, { message: 'La fecha "hasta" debe tener el formato AAAA-MM-DD' })
  hasta?: string;
}

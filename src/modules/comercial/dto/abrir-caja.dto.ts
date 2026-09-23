import { Type } from 'class-transformer';
import { IsInt, IsNumber, Min } from 'class-validator';

export class AbrirCajaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idSucursal: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoInicial: number;
}

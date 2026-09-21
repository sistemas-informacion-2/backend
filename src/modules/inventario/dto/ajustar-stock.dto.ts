import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export type TipoAjusteStock = 'ENTRADA' | 'SALIDA' | 'AJUSTE';

export class AjustarStockDto {
  @IsIn(['ENTRADA', 'SALIDA', 'AJUSTE'])
  tipo: TipoAjusteStock;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  cantidad: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  motivo?: string;
}

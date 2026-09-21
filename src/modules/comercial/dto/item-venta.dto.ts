import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class ItemVentaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idVarianteProducto: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad: number;
}

import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CajaAbiertaQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idSucursal: number;
}

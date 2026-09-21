import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ActualizarStockDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockMinimo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockMaximo?: number;
}

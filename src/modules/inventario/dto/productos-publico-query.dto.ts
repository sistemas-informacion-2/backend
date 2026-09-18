import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class ProductosPublicoQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idCategoria?: number;
}

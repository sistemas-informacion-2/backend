import { ArrayUnique, IsArray, IsInt, Min } from 'class-validator';

export class GestionarSucursalesProductoDto {
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  sucursalIds: number[];
}

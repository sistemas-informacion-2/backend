import { ArrayUnique, IsArray, IsInt, Min } from 'class-validator';

export class GestionarPermisosRolDto {
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  permisos: number[];
}

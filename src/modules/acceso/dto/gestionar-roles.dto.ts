import { ArrayUnique, IsArray, IsInt, Min } from 'class-validator';

export class GestionarRolesDto {
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  roles: number[];
}

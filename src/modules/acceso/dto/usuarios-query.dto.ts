import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UsuariosQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['A', 'E', 'C'])
  tipoUsuario?: 'A' | 'E' | 'C';

  @IsOptional()
  @IsIn(['HABILITADO', 'BLOQUEADO', 'SUSPENDIDO'])
  estadoAcceso?: 'HABILITADO' | 'BLOQUEADO' | 'SUSPENDIDO';

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  activo?: boolean;
}

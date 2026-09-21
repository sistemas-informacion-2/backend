import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CrearAlmacenDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idSucursal: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  ubicacionFisica?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

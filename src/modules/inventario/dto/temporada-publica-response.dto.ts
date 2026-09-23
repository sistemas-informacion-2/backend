import { TemporadaResponseDto } from './temporada-response.dto.js';

export class CategoriaTemporadaPublicaDto {
  id: number;
  nombre: string;
}

export class TemporadaPublicaResponseDto extends TemporadaResponseDto {
  categorias: CategoriaTemporadaPublicaDto[];
}

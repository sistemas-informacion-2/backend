import { Injectable, NotFoundException } from '@nestjs/common';
import { BitacoraRepository } from '../repositories/bitacora.repository.js';
import { toBitacoraResponse } from '../mappers/bitacora.mapper.js';
import type { BitacoraQueryDto } from '../dto/bitacora-query.dto.js';
import type { BitacoraPaginatedResponseDto, BitacoraResponseDto } from '../dto/bitacora-response.dto.js';

@Injectable()
export class BitacoraService {
  constructor(private readonly bitacoraRepo: BitacoraRepository) {}

  async listar(query: BitacoraQueryDto): Promise<BitacoraPaginatedResponseDto> {
    const resultado = await this.bitacoraRepo.listar(query);
    return {
      items: resultado.items.map(toBitacoraResponse),
      meta: { page: query.page, limit: query.limit, total: resultado.total, totalPages: Math.ceil(resultado.total / query.limit) },
    };
  }

  async obtenerPorId(id: string): Promise<BitacoraResponseDto> {
    const log = await this.bitacoraRepo.obtenerPorId(id);
    if (!log) throw new NotFoundException('Registro de bitácora no encontrado');
    return toBitacoraResponse(log);
  }
}
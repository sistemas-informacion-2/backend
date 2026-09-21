import type { PasarelaPago } from '../entities/pasarela-pago.entity.js';
import type { PasarelaResponseDto } from '../dto/pasarela-response.dto.js';

export function toPasarelaResponseDto(pasarela: PasarelaPago): PasarelaResponseDto {
  return {
    id: pasarela.id,
    codigo: pasarela.codigo,
    metodo: pasarela.metodo,
    descripcion: pasarela.descripcion,
    integracion: pasarela.integracion,
    comisionPorcentaje: Number(pasarela.comisionPorcentaje),
    disponiblePresencial: pasarela.disponiblePresencial,
    disponibleLinea: pasarela.disponibleLinea,
    tieneApiKey: !!pasarela.apiKeyEncriptada,
    origenCredenciales: pasarela.apiKeyEncriptada ? 'PANEL' : 'NINGUNA',
  };
}

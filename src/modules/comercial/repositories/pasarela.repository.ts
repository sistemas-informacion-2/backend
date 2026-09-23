import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, type Repository } from 'typeorm';
import { PasarelaPago } from '../entities/pasarela-pago.entity.js';

@Injectable()
export class PasarelaRepository {
  constructor(@InjectRepository(PasarelaPago) private readonly repo: Repository<PasarelaPago>) {}

  findWithFilters(query: {
    search?: string;
    integracion?: string;
    disponiblePresencial?: boolean;
    disponibleLinea?: boolean;
  }): Promise<PasarelaPago[]> {
    const builder = this.repo.createQueryBuilder('pasarela').orderBy('pasarela.id', 'ASC');

    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      builder.andWhere(
        new Brackets((where) => {
          where
            .where('LOWER(pasarela.codigo) LIKE :search', { search })
            .orWhere('LOWER(pasarela.metodo) LIKE :search', { search });
        }),
      );
    }
    if (query.integracion) builder.andWhere('pasarela.integracion = :integracion', { integracion: query.integracion });
    if (query.disponiblePresencial !== undefined) {
      builder.andWhere('pasarela.disponible_presencial = :disponiblePresencial', {
        disponiblePresencial: query.disponiblePresencial,
      });
    }
    if (query.disponibleLinea !== undefined) {
      builder.andWhere('pasarela.disponible_linea = :disponibleLinea', { disponibleLinea: query.disponibleLinea });
    }

    return builder.getMany();
  }

  findPresencial(): Promise<PasarelaPago[]> {
    return this.repo.find({ where: { disponiblePresencial: true }, order: { id: 'ASC' } });
  }

  findLinea(): Promise<PasarelaPago[]> {
    return this.repo.find({ where: { disponibleLinea: true }, order: { id: 'ASC' } });
  }

  findById(id: number): Promise<PasarelaPago | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByCodigo(codigo: string): Promise<PasarelaPago | null> {
    return this.repo.findOne({ where: { codigo } });
  }

  create(datos: Partial<PasarelaPago>): PasarelaPago {
    return this.repo.create(datos);
  }

  save(pasarela: PasarelaPago): Promise<PasarelaPago> {
    return this.repo.save(pasarela);
  }
}

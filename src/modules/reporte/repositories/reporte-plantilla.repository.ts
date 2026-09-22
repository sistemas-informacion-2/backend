import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ReportePlantilla } from '../entities/reporte-plantilla.entity.js';

@Injectable()
export class ReportePlantillaRepository {
  constructor(@InjectRepository(ReportePlantilla) private readonly repo: Repository<ReportePlantilla>) {}

  listarPorUsuario(idUsuario: number): Promise<ReportePlantilla[]> {
    return this.repo.find({
      where: { idUsuario },
      order: { fechaActualizacion: 'DESC' },
    });
  }

  buscarPorId(id: number): Promise<ReportePlantilla | null> {
    return this.repo.findOne({ where: { id } });
  }

  crear(datos: Partial<ReportePlantilla>): Promise<ReportePlantilla> {
    return this.repo.save(this.repo.create(datos));
  }

  async actualizar(plantilla: ReportePlantilla, cambios: Partial<ReportePlantilla>): Promise<ReportePlantilla> {
    this.repo.merge(plantilla, cambios, { fechaActualizacion: new Date() });
    return this.repo.save(plantilla);
  }

  async eliminar(id: number): Promise<void> {
    const resultado = await this.repo.delete(id);
    if (!resultado.affected) {
      throw new NotFoundException('Plantilla no encontrada');
    }
  }

  /** Devuelve la plantilla solo si pertenece al usuario actual (aislamiento por usuario). */
  async buscarPropia(id: number, idUsuario: number): Promise<ReportePlantilla> {
    const plantilla = await this.repo.findOne({ where: { id, idUsuario } });
    if (!plantilla) {
      throw new NotFoundException('Plantilla no encontrada');
    }
    return plantilla;
  }
}
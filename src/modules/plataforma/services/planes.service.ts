import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { Plan, type CodigoPlan } from '../entities/plan.entity.js';
import { toPlanResponse } from '../mappers/plan.mapper.js';
import type { PlanResponseDto } from '../dto/plan.dto.js';

@Injectable()
export class PlanesService {
  constructor(@InjectRepository(Plan) private readonly planRepo: Repository<Plan>) {}

  /** Los planes que se ofrecen (landing, registro y cambio de plan), en el orden de las tarjetas. */
  async listarActivos(): Promise<PlanResponseDto[]> {
    const planes = await this.planRepo.find({ where: { activo: true }, order: { orden: 'ASC', id: 'ASC' } });
    return planes.map(toPlanResponse);
  }

  /** Un plan que se puede contratar; 400 si no existe o ya no se ofrece. */
  async contratable(codigo: CodigoPlan, manager?: EntityManager): Promise<Plan> {
    const repo = manager ? manager.getRepository(Plan) : this.planRepo;
    const plan = await repo.findOne({ where: { codigo } });
    if (!plan || !plan.activo) throw new BadRequestException('El plan indicado no está disponible');
    return plan;
  }

  /** Cualquier plan por codigo, aunque ya no se ofrezca (el superadmin puede asignarlo). */
  async porCodigo(codigo: CodigoPlan): Promise<Plan> {
    const plan = await this.planRepo.findOne({ where: { codigo } });
    if (!plan) throw new BadRequestException('El plan indicado no existe');
    return plan;
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { SuscripcionWebPush } from '../entities/suscripcion-web-push.entity.js';

@Injectable()
export class SuscripcionWebPushRepository {
  constructor(@InjectRepository(SuscripcionWebPush) private readonly repo: Repository<SuscripcionWebPush>) {}

  /** Alta o reasignacion por endpoint: el mismo navegador puede pasar de un usuario a otro. */
  async registrar(idUsuario: number, endpoint: string, p256dh: string, auth: string): Promise<void> {
    await this.repo.upsert({ idUsuario, endpoint, p256dh, auth, fechaActualizacion: new Date() }, { conflictPaths: ['endpoint'] });
  }

  /** Solo borra si la suscripcion es de ese usuario: nadie puede dar de baja el navegador de otro. */
  async eliminar(endpoint: string, idUsuario: number): Promise<void> {
    await this.repo.delete({ endpoint, idUsuario });
  }

  listarDeUsuarios(idsUsuario: number[]): Promise<SuscripcionWebPush[]> {
    if (idsUsuario.length === 0) return Promise.resolve([]);
    return this.repo.find({ where: { idUsuario: In(idsUsuario) } });
  }

  async eliminarPorEndpoints(endpoints: string[]): Promise<void> {
    if (endpoints.length === 0) return;
    await this.repo.delete({ endpoint: In(endpoints) });
  }
}

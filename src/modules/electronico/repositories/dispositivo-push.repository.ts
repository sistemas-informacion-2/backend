import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { DispositivoPush, type PlataformaPush } from '../entities/dispositivo-push.entity.js';

@Injectable()
export class DispositivoPushRepository {
  constructor(@InjectRepository(DispositivoPush) private readonly repo: Repository<DispositivoPush>) {}

  /** Alta o reasignacion por token: el mismo celular puede pasar de un usuario a otro. */
  async registrar(idUsuario: number, token: string, plataforma: PlataformaPush): Promise<void> {
    await this.repo.upsert(
      { idUsuario, token, plataforma, activo: true, fechaActualizacion: new Date() },
      { conflictPaths: ['token'] },
    );
  }

  /** Solo desactiva si el token es de ese usuario: nadie puede dar de baja el celular de otro. */
  async desactivarPorToken(token: string, idUsuario: number): Promise<void> {
    await this.repo.update({ token, idUsuario }, { activo: false, fechaActualizacion: new Date() });
  }

  async listarActivosDeUsuarios(idsUsuario: number[]): Promise<Array<{ idUsuario: number; token: string }>> {
    if (idsUsuario.length === 0) return [];
    return this.repo.find({
      where: { idUsuario: In(idsUsuario), activo: true },
      select: { idUsuario: true, token: true },
    });
  }

  async desactivarPorTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.repo.update({ token: In(tokens) }, { activo: false, fechaActualizacion: new Date() });
  }
}

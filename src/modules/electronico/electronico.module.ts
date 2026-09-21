import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../acceso/entities/usuario.entity.js';
import { NotificacionPush } from './entities/notificacion-push.entity.js';
import { NotificacionRepository } from './repositories/notificacion.repository.js';
import { NotificacionesService } from './services/notificaciones.service.js';
import { NotificacionesController } from './controllers/notificaciones.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([NotificacionPush, Usuario])],
  controllers: [NotificacionesController],
  providers: [NotificacionesService, NotificacionRepository],
  exports: [TypeOrmModule],
})
export class ElectronicoModule {}

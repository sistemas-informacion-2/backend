import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../acceso/entities/usuario.entity.js';
import { VarianteProducto } from '../inventario/entities/variante-producto.entity.js';
import { InventarioModule } from '../inventario/inventario.module.js';
import { NotificacionPush } from './entities/notificacion-push.entity.js';
import { Carrito } from './entities/carrito.entity.js';
import { DetalleCarrito } from './entities/detalle-carrito.entity.js';
import { Reserva } from './entities/reserva.entity.js';
import { DetalleReserva } from './entities/detalle-reserva.entity.js';
import { EmpleadoSucursal } from '../operaciones/entities/empleado-sucursal.entity.js';
import { Sucursal } from '../operaciones/entities/sucursal.entity.js';
import { ReservaRepository } from './repositories/reserva.repository.js';
import { ComprasOfflineService } from './services/compras-offline.service.js';
import { ReservasService } from './services/reservas.service.js';
import { PasarelaPago } from '../comercial/entities/pasarela-pago.entity.js';
import { StripeService } from './services/stripe.service.js';
import { CheckoutService } from './services/checkout.service.js';
import { CheckoutController } from './controllers/checkout.controller.js';
import { CheckoutOfflineController } from './controllers/checkout-offline.controller.js';
import { ReservasController } from './controllers/reservas.controller.js';
import { NotificacionRepository } from './repositories/notificacion.repository.js';
import { CarritoRepository } from './repositories/carrito.repository.js';
import { NotificacionesService } from './services/notificaciones.service.js';
import { CarritoService } from './services/carrito.service.js';
import { NotificacionesController } from './controllers/notificaciones.controller.js';
import { CarritoController } from './controllers/carrito.controller.js';
import { DispositivoPush } from './entities/dispositivo-push.entity.js';
import { DispositivoPushRepository } from './repositories/dispositivo-push.repository.js';
import { PushService } from './services/push.service.js';
import { WebPushService } from './services/web-push.service.js';
import { SuscripcionWebPush } from './entities/suscripcion-web-push.entity.js';
import { SuscripcionWebPushRepository } from './repositories/suscripcion-web-push.repository.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificacionPush, DispositivoPush, SuscripcionWebPush, Usuario, Carrito, DetalleCarrito, VarianteProducto, Reserva, DetalleReserva, EmpleadoSucursal, Sucursal, PasarelaPago]),
    InventarioModule,
  ],
  controllers: [NotificacionesController, CarritoController, ReservasController, CheckoutController, CheckoutOfflineController],
  providers: [
    NotificacionesService,
    NotificacionRepository,
    DispositivoPushRepository,
    PushService,
    WebPushService,
    SuscripcionWebPushRepository,
    CarritoService,
    CarritoRepository,
    ReservasService,
    ComprasOfflineService,
    ReservaRepository,
    StripeService,
    CheckoutService,
  ],
  exports: [TypeOrmModule, NotificacionesService],
})
export class ElectronicoModule {}

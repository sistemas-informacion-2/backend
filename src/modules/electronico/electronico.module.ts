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
import { ReservasService } from './services/reservas.service.js';
import { PasarelaPago } from '../comercial/entities/pasarela-pago.entity.js';
import { PaypalService } from './services/paypal.service.js';
import { CheckoutService } from './services/checkout.service.js';
import { CheckoutController } from './controllers/checkout.controller.js';
import { ReservasController } from './controllers/reservas.controller.js';
import { NotificacionRepository } from './repositories/notificacion.repository.js';
import { CarritoRepository } from './repositories/carrito.repository.js';
import { NotificacionesService } from './services/notificaciones.service.js';
import { CarritoService } from './services/carrito.service.js';
import { NotificacionesController } from './controllers/notificaciones.controller.js';
import { CarritoController } from './controllers/carrito.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificacionPush, Usuario, Carrito, DetalleCarrito, VarianteProducto, Reserva, DetalleReserva, EmpleadoSucursal, Sucursal, PasarelaPago]),
    InventarioModule,
  ],
  controllers: [NotificacionesController, CarritoController, ReservasController, CheckoutController],
  providers: [NotificacionesService, NotificacionRepository, CarritoService, CarritoRepository, ReservasService, ReservaRepository, PaypalService, CheckoutService],
  exports: [TypeOrmModule],
})
export class ElectronicoModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sucursal } from '../operaciones/entities/sucursal.entity.js';
import { Empleado } from '../operaciones/entities/empleado.entity.js';
import { Cliente } from '../operaciones/entities/cliente.entity.js';
import { Inventario } from '../inventario/entities/inventario.entity.js';
import { VarianteProducto } from '../inventario/entities/variante-producto.entity.js';
import { Producto } from '../inventario/entities/producto.entity.js';
import { PasarelaPago } from './entities/pasarela-pago.entity.js';
import { Caja } from './entities/caja.entity.js';
import { MovimientoCaja } from './entities/movimiento-caja.entity.js';
import { NotaVenta } from './entities/nota-venta.entity.js';
import { DetalleNotaVenta } from './entities/detalle-nota-venta.entity.js';
import { Pago } from './entities/pago.entity.js';
import { PasarelaRepository } from './repositories/pasarela.repository.js';
import { CajaRepository } from './repositories/caja.repository.js';
import { MovimientoCajaRepository } from './repositories/movimiento-caja.repository.js';
import { NotaVentaRepository } from './repositories/nota-venta.repository.js';
import { PagoRepository } from './repositories/pago.repository.js';
import { PasarelasService } from './services/pasarelas.service.js';
import { CajaService } from './services/caja.service.js';
import { VentasService } from './services/ventas.service.js';
import { PasarelasController } from './controllers/pasarelas.controller.js';
import { CajasController } from './controllers/cajas.controller.js';
import { VentasController } from './controllers/ventas.controller.js';
import { PasarelaSeederService } from './seeders/pasarela-seeder.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PasarelaPago,
      Caja,
      MovimientoCaja,
      NotaVenta,
      DetalleNotaVenta,
      Pago,
      Sucursal,
      Empleado,
      Cliente,
      Inventario,
      VarianteProducto,
      Producto,
    ]),
  ],
  controllers: [PasarelasController, CajasController, VentasController],
  providers: [
    PasarelasService,
    PasarelaRepository,
    PasarelaSeederService,
    CajaService,
    CajaRepository,
    MovimientoCajaRepository,
    VentasService,
    NotaVentaRepository,
    PagoRepository,
  ],
  exports: [TypeOrmModule, PasarelaSeederService],
})
export class ComercialModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sucursal } from '../operaciones/entities/sucursal.entity.js';
import { EmpleadoSucursal } from '../operaciones/entities/empleado-sucursal.entity.js';
import { Empleado } from '../operaciones/entities/empleado.entity.js';
import { Cliente } from '../operaciones/entities/cliente.entity.js';
import { Proveedor } from '../inventario/entities/proveedor.entity.js';
import { Almacen } from '../inventario/entities/almacen.entity.js';
import { VarianteProducto } from '../inventario/entities/variante-producto.entity.js';
import { Producto } from '../inventario/entities/producto.entity.js';
import { ProductoSucursal } from '../inventario/entities/producto-sucursal.entity.js';
import { Inventario } from '../inventario/entities/inventario.entity.js';
import { NotaCompra } from './entities/nota-compra.entity.js';
import { DetalleNotaCompra } from './entities/detalle-nota-compra.entity.js';
import { PasarelaPago } from './entities/pasarela-pago.entity.js';
import { Caja } from './entities/caja.entity.js';
import { MovimientoCaja } from './entities/movimiento-caja.entity.js';
import { NotaVenta } from './entities/nota-venta.entity.js';
import { DetalleNotaVenta } from './entities/detalle-nota-venta.entity.js';
import { Pago } from './entities/pago.entity.js';
import { NotaDevolucion } from './entities/nota-devolucion.entity.js';
import { DetalleNotaDevolucion } from './entities/detalle-nota-devolucion.entity.js';
import { PasarelaRepository } from './repositories/pasarela.repository.js';
import { CajaRepository } from './repositories/caja.repository.js';
import { MovimientoCajaRepository } from './repositories/movimiento-caja.repository.js';
import { NotaVentaRepository } from './repositories/nota-venta.repository.js';
import { PagoRepository } from './repositories/pago.repository.js';
import { DevolucionRepository } from './repositories/devolucion.repository.js';
import { DevolucionesService } from './services/devoluciones.service.js';
import { VentasEnLineaController } from './controllers/ventas-en-linea.controller.js';
import { VentasEnLineaService } from './services/ventas-en-linea.service.js';
import { CuentaClienteController } from './controllers/cuenta-cliente.controller.js';
import { DevolucionesController } from './controllers/devoluciones.controller.js';
import { PasarelasService } from './services/pasarelas.service.js';
import { CajaService } from './services/caja.service.js';
import { ComprasService } from './services/compras.service.js';
import { CompraRepository } from './repositories/compra.repository.js';
import { ComprasController } from './controllers/compras.controller.js';
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
      NotaDevolucion,
      DetalleNotaDevolucion,
      NotaCompra,
      DetalleNotaCompra,
      Sucursal,
      EmpleadoSucursal,
      Empleado,
      Cliente,
      Proveedor,
      Almacen,
      Inventario,
      VarianteProducto,
      Producto,
      ProductoSucursal,
    ]),
  ],
  controllers: [PasarelasController, CajasController, VentasController, ComprasController, DevolucionesController, CuentaClienteController, VentasEnLineaController],
  providers: [
    PasarelasService,
    PasarelaRepository,
    PasarelaSeederService,
    CajaService,
    CajaRepository,
    MovimientoCajaRepository,
    ComprasService,
    CompraRepository,
    VentasService,
    DevolucionesService,
    VentasEnLineaService,
    DevolucionRepository,
    NotaVentaRepository,
    PagoRepository,
  ],
  exports: [TypeOrmModule, PasarelaSeederService],
})
export class ComercialModule {}
